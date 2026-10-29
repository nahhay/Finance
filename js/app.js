const $ = s => document.querySelector(s);
const brl = n => Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const CATS = ["Moradia", "Contas básicas", "Assinaturas", "Cartão", "Saúde", "Transporte", "Educação", "Outros"];
const PAYS = ["Boleto", "Débito automático", "Cartão", "Pix"];
const LABEL = { late: "Vencida", today: "Vence hoje", soon: "Vence em breve", paid: "Paga", ok: "Em dia" };

const ym = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
const addM = (m, n) => { const [y, mo] = m.split("-").map(Number); return ym(new Date(y, mo - 1 + n, 1)); };
const diffM = (a, b) => { const [y1, m1] = a.split("-").map(Number), [y2, m2] = b.split("-").map(Number); return (y2 - y1) * 12 + (m2 - m1); };
const mname = (m, short) => { const [y, mo] = m.split("-").map(Number); return new Date(y, mo - 1, 1).toLocaleDateString("pt-BR", short ? { month: "short" } : { month: "long", year: "numeric" }).replace(".", ""); };
const dueDate = (m, day) => { const [y, mo] = m.split("-").map(Number); return new Date(y, mo - 1, Math.min(day, new Date(y, mo, 0).getDate())); };
const todayD = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); };
const fmtD = d => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

const S = { tab: "home", user: null, bills: [], pays: [], month: ym(new Date()), filter: "all", authMode: "login" };

function toast(msg, ms = 2500) { const t = $("#toast"); t.textContent = msg; t.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("on"), ms); }
const defDays = () => Number(localStorage.getItem("nd") ?? 3);

// Contas que existem em um determinado mês, com status calculado
function billsFor(m) {
  const t = todayD();
  return S.bills.filter(b => b.start_month <= m && (b.recurrence === "once" ? b.start_month === m : (!b.installments || diffM(b.start_month, m) < b.installments)))
    .map(b => {
      const pay = S.pays.find(p => p.bill_id === b.id && p.month === m);
      const due = dueDate(m, b.due_day);
      const days = Math.round((due - t) / 864e5);
      const status = pay ? "paid" : days < 0 ? "late" : days === 0 ? "today" : days <= b.notify_days ? "soon" : "ok";
      const n = b.installments ? diffM(b.start_month, m) + 1 : 0;
      return { ...b, pay, due, days, status, n, value: pay ? Number(pay.amount) : Number(b.amount) };
    }).sort((a, b) => a.due - b.due);
}
const sum = l => l.reduce((s, b) => s + b.value, 0);

async function refresh() {
  try { Object.assign(S, await DB.load()); } catch (e) { toast("Erro ao carregar: " + e.message); }
  render(); welcome();
}

/* ---------- Login ---------- */
function renderAuth() {
  const login = S.authMode === "login";
  $("#app").innerHTML = `<div class="login"><h1>Minhas Contas</h1><p class="sub">${login ? "Entre para ver suas contas." : "Crie seu acesso pessoal."}</p>
    <label>E-mail</label><input id="em" type="email" autocomplete="email" autocapitalize="none">
    <label>Senha</label><input id="pw" type="password" autocomplete="${login ? "current-password" : "new-password"}">
    <div class="err" id="err"></div>
    <button class="btn" id="go">${login ? "Entrar" : "Criar conta"}</button>
    <button class="link" id="sw">${login ? "Não tenho conta. Criar agora" : "Já tenho conta. Entrar"}</button></div>`;
  $("#sw").onclick = () => { S.authMode = login ? "signup" : "login"; renderAuth(); };
  $("#go").onclick = async () => {
    const e = $("#em").value.trim(), p = $("#pw").value;
    if (!e || p.length < 6) { $("#err").textContent = "Informe e-mail e senha com pelo menos 6 caracteres."; return; }
    $("#go").disabled = true;
    try {
      if (login) await DB.login(e, p);
      else if (!(await DB.signup(e, p))) { $("#err").textContent = "Conta criada. Confirme pelo link enviado ao seu e-mail e entre."; $("#go").disabled = false; return; }
    } catch (x) {
      $("#err").textContent = /Invalid login/i.test(x.message) ? "E-mail ou senha incorretos." : x.message;
      $("#go").disabled = false;
    }
  };
}

/* ---------- Estrutura ---------- */
function render() {
  const tabs = [["home", "Início"], ["bills", "Contas"], ["hist", "Histórico"], ["cfg", "Config"]];
  const view = { home: vHome, bills: vBills, hist: vHist, cfg: vCfg }[S.tab]();
  $("#app").innerHTML = `<header><b>Contas</b><div><span>${esc(S.user.email.split("@")[0])}</span><button id="out">Sair</button></div></header>
    <main>${view}</main>${S.tab === "cfg" ? "" : '<button class="fab" id="add" aria-label="Nova conta">+</button>'}
    <nav>${tabs.map(([k, n]) => `<button data-t="${k}" class="${S.tab === k ? "on" : ""}">${n}</button>`).join("")}</nav>`;
  $("#out").onclick = () => DB.logout();
  document.querySelectorAll("nav button").forEach(b => b.onclick = () => { S.tab = b.dataset.t; render(); window.scrollTo(0, 0); });
  if ($("#add")) $("#add").onclick = () => openForm();
  bind();
}

function bind() {
  document.querySelectorAll("[data-pay]").forEach(b => b.onclick = e => { e.stopPropagation(); togglePay(b.dataset.pay, b.dataset.m); });
  document.querySelectorAll("[data-edit]").forEach(b => b.onclick = () => openForm(S.bills.find(x => x.id === b.dataset.edit)));
  document.querySelectorAll("[data-mv]").forEach(b => b.onclick = () => { S.month = addM(S.month, Number(b.dataset.mv)); render(); });
  document.querySelectorAll("[data-go]").forEach(b => b.onclick = () => { S.month = b.dataset.go; S.tab = "bills"; render(); });
  const f = $("#flt"); if (f) f.onchange = () => { S.filter = f.value; render(); };
  const nd = $("#nd"); if (nd) nd.onchange = () => { localStorage.setItem("nd", Math.max(0, Number(nd.value) || 0)); toast("Salvo"); };
  document.querySelectorAll("[data-set]").forEach(b => b.onclick = () => { S.month = b.dataset.set; render(); });
  document.querySelectorAll("[data-cur]").forEach(b => b.onclick = () => { S.month = cur(); render(); });
  const on = (id, fn) => { const e = $(id); if (e) e.onclick = fn; };
  on("#ics", exportIcs); on("#csv", exportCsv); on("#bk", exportBackup); on("#rs", () => $("#rsf").click());
  const rsf = $("#rsf"); if (rsf) rsf.onchange = e => { if (e.target.files[0]) importBackup(e.target.files[0]); e.target.value = ""; };
  const wl = $("#wl"); if (wl) wl.onchange = () => { localStorage.setItem("wl", wl.value); toast("Salvo"); };
  on("#chpw", async () => {
    const p = $("#npw").value; if (p.length < 6) return toast("Use pelo menos 6 caracteres");
    try { await DB.setPassword(p); $("#npw").value = ""; toast("Senha alterada"); } catch (e) { toast("Erro: " + e.message); }
  });
}

async function togglePay(id, m) {
  const b = billsFor(m).find(x => x.id === id); if (!b) return;
  try {
    if (b.pay) await DB.unpay(id, m);
    else {
      const v = prompt("Valor pago (R$):", String(b.amount).replace(".", ","));
      if (v === null) return;
      const n = parseFloat(v.replace(/\./g, "").replace(",", "."));
      if (isNaN(n) || n < 0) return toast("Valor inválido");
      await DB.pay(id, m, n, S.user.id);
    }
    await refresh(); toast(b.pay ? "Pagamento desfeito" : "Marcada como paga");
  } catch (e) { toast("Erro: " + e.message); }
}

/* ---------- Telas ---------- */
function item(b, m) {
  return `<div class="row" data-edit="${b.id}"><div><div class="t">${esc(b.name)}</div>
    <small><span class="tag ${b.status}">${LABEL[b.status]}</span>${b.status === "paid" ? "" : "dia " + fmtD(b.due)}${b.n ? " · parcela " + b.n + "/" + b.installments : ""} · ${esc(b.category)}</small></div>
    <div class="r"><div class="t ${b.status === "paid" ? "ok" : b.status === "late" ? "bad" : ""}">${brl(b.value)}</div>
    <button class="pay ${b.pay ? "done" : ""}" data-pay="${b.id}" data-m="${m}">${b.pay ? "Paga ✓" : "Marcar paga"}</button></div></div>`;
}

const cur = () => ym(new Date());
function mnav(reset) {
  return `<div class="mnav"><button data-mv="-1">‹</button><b>${mname(S.month)}</b><button data-mv="1">›</button></div>` +
    (reset && S.month !== cur() ? `<button class="btn out" data-cur style="margin:-4px 0 14px;padding:10px">Voltar para ${mname(cur())}</button>` : "");
}

function welcome() {
  if (S.welcomed) return; S.welcomed = true;
  if (localStorage.getItem("wl") === "0") return;
  const a = billsFor(cur()).filter(b => !b.pay && ["late", "today", "soon"].includes(b.status));
  if (a.length) toast(a.length + (a.length > 1 ? " contas vencidas ou perto de vencer" : " conta vencida ou perto de vencer"), 5000);
}

function vHome() {
  const m = S.month, l = billsFor(m), pend = l.filter(b => !b.pay);
  const total = sum(l), paid = sum(l.filter(b => b.pay)), pct = total ? Math.round(paid / total * 100) : 0;
  const prev = sum(billsFor(addM(m, -1))), d = total - prev;
  const months = [5, 4, 3, 2, 1, 0].map(i => addM(m, -i)), tot = months.map(x => sum(billsFor(x))), max = Math.max(...tot, 1);
  const byPm = PAYS.map(p => [p, sum(l.filter(b => b.pay_method === p))]);
  const cmp = !prev ? "Sem contas no mês anterior para comparar."
    : d === 0 ? "Igual ao mês anterior."
    : `${d > 0 ? "▲" : "▼"} ${brl(Math.abs(d))} ${d > 0 ? "a mais" : "a menos"} que em ${mname(addM(m, -1), 1)}.`;
  return `<h1>Visão geral</h1><p class="sub">${mname(m)}</p>${mnav(true)}
    <div class="grid"><div class="card"><h3>Falta pagar</h3><div class="big bad">${brl(sum(pend))}</div></div>
    <div class="card"><h3>Já pago</h3><div class="big ok">${brl(paid)}</div></div>
    <div class="card"><h3>Total do mês</h3><div class="big">${brl(total)}</div></div>
    <div class="card"><h3>Vencidas</h3><div class="big">${l.filter(b => b.status === "late").length}</div></div></div>
    <div class="card"><h3>Progresso do mês: ${pct}% pago</h3><div class="prog"><i style="width:${pct}%"></i></div>
    <small class="cmp ${d > 0 ? "bad" : d < 0 ? "ok" : ""}">${cmp}</small></div>
    <div class="card"><h3>Próximas contas</h3>${pend.length ? pend.slice(0, 5).map(b => item(b, m)).join("") + (pend.length > 5 ? `<div class="row" data-go="${m}"><span>Ver todas as ${pend.length} pendentes</span><b>›</b></div>` : "") : `<div class="empty">${l.length ? "Tudo pago neste mês." : "Sem contas neste mês."}</div>`}</div>
    <div class="card"><h3>Gastos nos 6 meses até ${mname(m)} (toque para abrir)</h3><div class="bars">${months.map((x, i) => `<div class="${x === m ? "sel" : ""}" data-set="${x}"><i style="height:${tot[i] / max * 90}%"></i>${mname(x, 1)}</div>`).join("")}</div></div>
    <div class="card"><h3>Por forma de pagamento</h3>${byPm.map(([p, v]) => `<div class="row"><span>${p}</span><b>${brl(v)}</b></div>`).join("")}</div>`;
}

function vBills() {
  let l = billsFor(S.month);
  if (S.filter === "pend") l = l.filter(b => !b.pay);
  if (S.filter === "paid") l = l.filter(b => b.pay);
  if (S.filter === "late") l = l.filter(b => b.status === "late");
  return `<h1>Contas</h1><p class="sub">Toque em uma conta para editar.</p>
    <div class="mnav"><button data-mv="-1">‹</button><b>${mname(S.month)}</b><button data-mv="1">›</button></div>
    <label style="margin-top:0">Filtro</label><select id="flt" style="margin-bottom:14px">
    ${[["all", "Todas"], ["pend", "Pendentes"], ["paid", "Pagas"], ["late", "Vencidas"]].map(([v, n]) => `<option value="${v}" ${S.filter === v ? "selected" : ""}>${n}</option>`).join("")}</select>
    <div class="card">${l.length ? l.map(b => item(b, S.month)).join("") : '<div class="empty">Nenhuma conta aqui. Toque em + para adicionar.</div>'}</div>`;
}

function vHist() {
  const l = billsFor(S.month), cats = {};
  l.forEach(b => cats[b.category] = (cats[b.category] || 0) + b.value);
  const data = Array.from({ length: 12 }, (_, i) => { const x = addM(S.month, -i), q = billsFor(x); return { m: x, n: q.length, p: q.filter(b => b.pay).length, t: sum(q) }; });
  const act = data.filter(x => x.n), totP = data.reduce((s, x) => s + x.t, 0), avg = act.length ? totP / act.length : 0;
  const top = act.reduce((a, x) => !a || x.t > a.t ? x : a, null), maxT = Math.max(...data.map(x => x.t), 1);
  return `<h1>Histórico</h1><p class="sub">Compare mês a mês.</p>${mnav(true)}
    <div class="card"><h3>Por categoria</h3>${Object.keys(cats).length ? Object.entries(cats).sort((a, b) => b[1] - a[1]).map(([c, v]) => `<div class="row"><span>${esc(c)}</span><b>${brl(v)}</b></div>`).join("") : '<div class="empty">Sem contas neste mês.</div>'}</div>
    <div class="card"><h3>Resumo dos 12 meses até ${mname(S.month)}</h3>
    <div class="row"><span>Total no período</span><b>${brl(totP)}</b></div>
    <div class="row"><span>Média por mês</span><b>${brl(avg)}</b></div>
    <div class="row"><span>Mês mais caro</span><b style="text-transform:capitalize">${top ? mname(top.m, 1) + " · " + brl(top.t) : "-"}</b></div></div>
    <div class="card"><h3>Mês a mês (toque para abrir o mês)</h3>${data.map((x, i) => {
      const pv = data[i + 1], dl = pv && pv.n && x.n ? x.t - pv.t : 0;
      return `<div class="row ${x.m === S.month ? "sel" : ""}" data-go="${x.m}"><div style="flex:1"><div class="t" style="text-transform:capitalize">${mname(x.m)}</div>
      <small>${!x.n ? "sem contas" : x.m > cur() ? "previsto" : x.p + " de " + x.n + " pagas"}</small><div class="prog" style="margin-top:6px"><i style="width:${x.t / maxT * 100}%"></i></div></div>
      <div class="r"><b>${brl(x.t)}</b>${dl ? `<small class="${dl > 0 ? "bad" : "ok"}">${dl > 0 ? "▲" : "▼"} ${brl(Math.abs(dl))}</small>` : ""}</div></div>`;
    }).join("")}</div>`;
}

function vCfg() {
  return `<h1>Configurações</h1><p class="sub">${esc(S.user.email)}</p>
    <div class="card"><h3>Aviso padrão para novas contas</h3><label style="margin-top:0">Avisar com quantos dias de antecedência?</label>
    <input id="nd" type="number" min="0" max="30" inputmode="numeric" value="${defDays()}">
    <p class="sub" style="margin-top:10px">Contas dentro desse prazo ficam em amarelo no painel.</p></div>
    <div class="card"><h3>Aviso ao abrir o app</h3><select id="wl"><option value="1" ${localStorage.getItem("wl") !== "0" ? "selected" : ""}>Mostrar quantas contas pedem atenção</option><option value="0" ${localStorage.getItem("wl") === "0" ? "selected" : ""}>Não mostrar</option></select></div>
    <div class="card"><h3>Avisos no calendário do iPhone</h3><p class="sub">Gera um arquivo com todas as suas contas e lembretes. Ao abrir, escolha adicionar ao Calendário e o iPhone avisa sozinho, mesmo com o app fechado.</p>
    <button class="btn" id="ics" style="margin-top:0">Exportar para o Calendário</button></div>
    <div class="card"><h3>Planilha</h3><p class="sub">Baixa um arquivo CSV com as contas dos últimos 12 meses, para abrir no Excel ou Numbers.</p>
    <button class="btn" id="csv" style="margin-top:0">Exportar planilha (CSV)</button></div>
    <div class="card"><h3>Backup</h3><p class="sub">Guarde uma cópia de tudo. Ao restaurar, as contas do arquivo são adicionadas às que você já tem.</p>
    <button class="btn" id="bk" style="margin-top:0">Baixar backup</button><button class="btn out" id="rs">Restaurar backup</button><input type="file" id="rsf" accept=".json,application/json" hidden></div>
    <div class="card"><h3>Trocar senha</h3><label style="margin-top:0">Nova senha</label><input id="npw" type="password" autocomplete="new-password">
    <button class="btn" id="chpw">Salvar nova senha</button></div>`;
}

function download(name, text, type) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
}
function exportCsv() {
  const q = v => '"' + String(v ?? "").replace(/"/g, '""') + '"';
  const rows = [["Mês", "Conta", "Categoria", "Vencimento", "Valor", "Status", "Forma de pagamento"]];
  for (let i = 11; i >= 0; i--) { const m = addM(cur(), -i); billsFor(m).forEach(b => rows.push([m, b.name, b.category, b.due.toLocaleDateString("pt-BR"), b.value.toFixed(2).replace(".", ","), LABEL[b.status], b.pay_method])); }
  if (rows.length === 1) return toast("Nenhuma conta para exportar");
  download("minhas-contas.csv", "\ufeff" + rows.map(r => r.map(q).join(";")).join("\r\n"), "text/csv");
}
function exportBackup() {
  download("backup-contas-" + new Date().toISOString().slice(0, 10) + ".json", JSON.stringify({ v: 1, bills: S.bills, pays: S.pays }), "application/json");
}
async function importBackup(file) {
  try {
    const d = JSON.parse(await file.text());
    if (!Array.isArray(d.bills)) throw new Error("Arquivo inválido");
    if (!confirm("Adicionar " + d.bills.length + " contas do backup?")) return;
    await DB.importAll(d, S.user.id); await refresh(); toast("Backup restaurado");
  } catch (e) { toast("Erro: " + e.message); }
}

/* ---------- Formulário ---------- */
function openForm(b) {
  const e = !!b, kind = e ? (b.recurrence === "once" ? "once" : b.installments ? "inst" : "fixed") : "fixed";
  const v = b || { name: "", category: CATS[0], amount: "", due_day: "", pay_method: PAYS[0], notify_days: defDays(), notes: "", start_month: ym(new Date()), installments: "" };
  const opt = (a, s) => a.map(x => `<option ${x === s ? "selected" : ""}>${x}</option>`).join("");
  const el = document.createElement("div"); el.className = "sheet";
  el.innerHTML = `<div><h1 style="font-size:21px">${e ? "Editar conta" : "Nova conta"}</h1>
    <label>Nome</label><input id="f_name" placeholder="Ex.: Aluguel" value="${esc(v.name)}">
    <label>Valor (R$). Se variar, coloque uma estimativa</label><input id="f_amount" inputmode="decimal" value="${v.amount === "" ? "" : String(v.amount).replace(".", ",")}">
    <label>Dia do vencimento</label><input id="f_day" type="number" min="1" max="31" inputmode="numeric" value="${v.due_day}">
    <label>Tipo</label><select id="f_kind"><option value="fixed" ${kind === "fixed" ? "selected" : ""}>Mensal (todo mês)</option><option value="inst" ${kind === "inst" ? "selected" : ""}>Parcelada</option><option value="once" ${kind === "once" ? "selected" : ""}>Única</option></select>
    <div id="f_instw" style="display:${kind === "inst" ? "block" : "none"}"><label>Número de parcelas</label><input id="f_inst" type="number" min="2" inputmode="numeric" value="${v.installments || ""}"></div>
    <label>Primeiro mês</label><input id="f_start" type="month" value="${v.start_month}">
    <label>Categoria</label><select id="f_cat">${opt(CATS, v.category)}</select>
    <label>Forma de pagamento</label><select id="f_pm">${opt(PAYS, v.pay_method)}</select>
    <label>Avisar quantos dias antes</label><input id="f_nd" type="number" min="0" max="30" inputmode="numeric" value="${v.notify_days}">
    <label>Observações (código de barras, link...)</label><textarea id="f_notes" rows="2">${esc(v.notes)}</textarea>
    <div class="err" id="f_err"></div>
    <button class="btn" id="f_save">Salvar</button>${e ? '<button class="btn del" id="f_del">Excluir conta</button>' : ""}<button class="btn out" id="f_cancel">Cancelar</button></div>`;
  document.body.appendChild(el);
  const close = () => el.remove(), q = s => el.querySelector(s);
  q("#f_kind").onchange = () => q("#f_instw").style.display = q("#f_kind").value === "inst" ? "block" : "none";
  q("#f_cancel").onclick = close;
  el.onclick = ev => { if (ev.target === el) close(); };
  if (e) q("#f_del").onclick = async () => {
    if (!confirm("Excluir esta conta e todos os pagamentos dela?")) return;
    try { await DB.deleteBill(b.id); close(); await refresh(); toast("Conta excluída"); } catch (x) { toast("Erro: " + x.message); }
  };
  q("#f_save").onclick = async () => {
    const k = q("#f_kind").value, amount = parseFloat(q("#f_amount").value.replace(/\./g, "").replace(",", ".")), day = parseInt(q("#f_day").value), inst = parseInt(q("#f_inst").value);
    const err = m => q("#f_err").textContent = m;
    if (!q("#f_name").value.trim()) return err("Informe o nome.");
    if (isNaN(amount) || amount < 0) return err("Informe um valor válido.");
    if (!(day >= 1 && day <= 31)) return err("O dia deve ficar entre 1 e 31.");
    if (!q("#f_start").value) return err("Informe o primeiro mês.");
    if (k === "inst" && !(inst >= 2)) return err("Informe o número de parcelas.");
    const bill = { name: q("#f_name").value.trim(), amount, due_day: day, recurrence: k === "once" ? "once" : "monthly", installments: k === "inst" ? inst : null, start_month: q("#f_start").value, category: q("#f_cat").value, pay_method: q("#f_pm").value, notify_days: Math.max(0, parseInt(q("#f_nd").value) || 0), notes: q("#f_notes").value.trim() };
    if (e) bill.id = b.id;
    q("#f_save").disabled = true;
    try { await DB.saveBill(bill, S.user.id); close(); await refresh(); toast("Conta salva"); } catch (x) { err(x.message); q("#f_save").disabled = false; }
  };
}

/* ---------- Exportar calendário (.ics) ---------- */
function exportIcs() {
  const cur = ym(new Date()), pad = n => String(n).padStart(2, "0"), ds = d => d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate());
  const out = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Minhas Contas//PT", "CALSCALE:GREGORIAN"];
  let count = 0;
  S.bills.forEach(b => {
    const first = b.start_month > cur ? b.start_month : cur, last = b.recurrence === "once" ? b.start_month : b.installments ? addM(b.start_month, b.installments - 1) : null;
    if (last && last < cur) return;
    const day = Math.min(b.due_day, 28), [y, mo] = first.split("-").map(Number), h = b.notify_days * 24 - 9;
    const rule = b.recurrence === "once" ? [] : ["RRULE:FREQ=MONTHLY" + (b.installments ? ";COUNT=" + (diffM(first, last) + 1) : "")];
    out.push("BEGIN:VEVENT", "UID:" + b.id + "@minhas-contas", "DTSTAMP:" + new Date().toISOString().replace(/[-:]|\.\d+/g, ""),
      "DTSTART;VALUE=DATE:" + ds(new Date(y, mo - 1, day)), "SUMMARY:Pagar " + b.name.replace(/[,;\n]/g, " ") + " (" + brl(b.amount) + ")", ...rule,
      "BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:Conta a vencer", "TRIGGER:" + (h >= 0 ? "-PT" + h : "PT" + (-h)) + "H", "END:VALARM", "END:VEVENT");
    count++;
  });
  out.push("END:VCALENDAR");
  if (!count) return toast("Nenhuma conta futura para exportar");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([out.join("\r\n")], { type: "text/calendar" }));
  a.download = "minhas-contas.ics"; document.body.appendChild(a); a.click(); a.remove();
}

/* ---------- Início ---------- */
async function boot() {
  if (!DB.configured) {
    $("#app").innerHTML = '<div class="login"><h1>Falta configurar</h1><p class="sub">Abra js/config.js e cole a URL e a chave do Supabase. O passo a passo está no README.</p></div>';
    return;
  }
  sb.auth.onAuthStateChange((ev, session) => {
    if (ev === "INITIAL_SESSION" || ev === "SIGNED_IN" || ev === "SIGNED_OUT") {
      const had = S.user && session && S.user.id === session.user.id;
      S.user = session ? session.user : null;
      if (!S.user) { S.bills = []; S.pays = []; S.tab = "home"; renderAuth(); }
      else if (!had) setTimeout(refresh, 0); // evita travar dentro do callback do auth
    }
  });
}
boot();
document.addEventListener("visibilitychange", () => { if (!document.hidden && S.user && !document.querySelector(".sheet")) refresh(); });
if ("serviceWorker" in navigator) addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
