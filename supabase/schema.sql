-- Cole tudo isto no Supabase: SQL Editor > New query > Run

create table if not exists bills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null,
  category text not null default 'Outros',
  amount numeric(12,2) not null default 0,
  due_day int not null check (due_day between 1 and 31),
  recurrence text not null default 'monthly' check (recurrence in ('monthly','once')),
  installments int,
  start_month text not null,          -- formato AAAA-MM
  pay_method text default 'Boleto',
  notify_days int not null default 3,
  notes text default '',
  created_at timestamptz not null default now()
);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  bill_id uuid not null references bills(id) on delete cascade,
  month text not null,                -- formato AAAA-MM
  amount numeric(12,2) not null,
  paid_at timestamptz not null default now(),
  unique (bill_id, month)
);

-- Cada pessoa enxerga apenas as próprias contas (você e sua namorada ficam separadas)
alter table bills enable row level security;
alter table payments enable row level security;

drop policy if exists "bills_own" on bills;
drop policy if exists "payments_own" on payments;
create policy "bills_own" on bills for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "payments_own" on payments for all using (user_id = auth.uid()) with check (user_id = auth.uid());
