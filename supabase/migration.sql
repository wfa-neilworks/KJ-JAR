-- Run this in Supabase SQL Editor to set up the JAR database schema

-- Enable UUID extension
create extension if not exists "pgcrypto";

-- Borrowers table
create table if not exists borrowers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  mobile text not null,
  address text not null,
  facebook text,
  guarantor text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Loan type enum
do $$ begin
  create type loan_type as enum ('monthly', 'weekly');
exception
  when duplicate_object then null;
end $$;

-- Loan status enum
do $$ begin
  create type loan_status as enum ('active', 'completed');
exception
  when duplicate_object then null;
end $$;

-- Loans table
create table if not exists loans (
  id uuid primary key default gen_random_uuid(),
  borrower_id uuid not null references borrowers(id),
  type loan_type not null,
  principal numeric(12, 2) not null,
  interest_rate numeric(5, 2) not null,
  total_due numeric(12, 2) not null,
  loan_date date not null,
  status loan_status not null default 'active',
  created_at timestamptz not null default now()
);

-- Payments table
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references loans(id) on delete cascade,
  week_number integer not null,
  amount_due numeric(12, 2) not null,
  due_date date not null,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

-- Indexes for common queries
create index if not exists idx_loans_borrower_id on loans(borrower_id);
create index if not exists idx_loans_status on loans(status);
create index if not exists idx_loans_type on loans(type);
create index if not exists idx_payments_loan_id on payments(loan_id);
create index if not exists idx_payments_due_date on payments(due_date);
create index if not exists idx_payments_paid_at on payments(paid_at);

-- Row Level Security (disable for now — enable and add policies when auth is added)
alter table borrowers enable row level security;
alter table loans enable row level security;
alter table payments enable row level security;

-- Allow all operations for anon role (single-user app, no auth yet)
create policy "allow_all_borrowers" on borrowers for all using (true) with check (true);
create policy "allow_all_loans" on loans for all using (true) with check (true);
create policy "allow_all_payments" on payments for all using (true) with check (true);
