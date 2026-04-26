-- Run this in Supabase SQL Editor (patch on top of migration_v4)

create table if not exists settle_loans (
  id uuid primary key default gen_random_uuid(),
  borrower_id uuid not null references borrowers(id),
  principal numeric(12, 2) not null,
  loan_date date not null,
  status text not null default 'active' check (status in ('active', 'completed')),
  created_at timestamptz not null default now()
);

create table if not exists settle_payments (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references settle_loans(id) on delete cascade,
  amount numeric(12, 2) not null,
  note text,
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_settle_loans_borrower_id on settle_loans(borrower_id);
create index if not exists idx_settle_loans_status on settle_loans(status);
create index if not exists idx_settle_payments_loan_id on settle_payments(loan_id);

alter table settle_loans enable row level security;
alter table settle_payments enable row level security;

create policy "allow_all_settle_loans" on settle_loans for all using (true) with check (true);
create policy "allow_all_settle_payments" on settle_payments for all using (true) with check (true);
