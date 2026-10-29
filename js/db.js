// Toda conversa com o banco passa por aqui.
const sb = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

const DB = {
  configured: !CONFIG.SUPABASE_URL.startsWith("COLE"),

  async session() { return (await sb.auth.getSession()).data.session; },
  async login(email, password) {
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
  },
  async signup(email, password) {
    const { data, error } = await sb.auth.signUp({ email, password });
    if (error) throw error;
    return !!data.session; // false = precisa confirmar e-mail
  },
  logout() { return sb.auth.signOut(); },

  async load() {
    const [b, p] = await Promise.all([
      sb.from("bills").select("*").order("due_day"),
      sb.from("payments").select("*")
    ]);
    if (b.error) throw b.error;
    if (p.error) throw p.error;
    return { bills: b.data, pays: p.data };
  },
  async saveBill(bill, userId) {
    const q = bill.id
      ? sb.from("bills").update(bill).eq("id", bill.id)
      : sb.from("bills").insert({ ...bill, user_id: userId });
    const { error } = await q;
    if (error) throw error;
  },
  async deleteBill(id) {
    const { error } = await sb.from("bills").delete().eq("id", id);
    if (error) throw error;
  },
  async pay(billId, month, amount, userId) {
    const { error } = await sb.from("payments").upsert(
      { bill_id: billId, month, amount, user_id: userId, paid_at: new Date().toISOString() },
      { onConflict: "bill_id,month" });
    if (error) throw error;
  },
  async unpay(billId, month) {
    const { error } = await sb.from("payments").delete().eq("bill_id", billId).eq("month", month);
    if (error) throw error;
  },
  async importAll(d, userId) {
    const map = {};
    for (const b of d.bills) {
      const { id, user_id, created_at, ...rest } = b;
      const { data, error } = await sb.from("bills").insert({ ...rest, user_id: userId }).select("id").single();
      if (error) throw error;
      map[id] = data.id;
    }
    const pays = (d.pays || []).filter(p => map[p.bill_id]).map(p => ({ bill_id: map[p.bill_id], month: p.month, amount: p.amount, paid_at: p.paid_at, user_id: userId }));
    if (pays.length) { const { error } = await sb.from("payments").insert(pays); if (error) throw error; }
  },
  async setPassword(pw) {
    const { error } = await sb.auth.updateUser({ password: pw });
    if (error) throw error;
  }
};
