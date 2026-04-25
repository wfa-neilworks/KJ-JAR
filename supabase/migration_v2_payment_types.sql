-- Run this in Supabase SQL Editor (patch on top of migration.sql)

-- Payment type enum
do $$ begin
  create type payment_collection_type as enum ('complete', 'interest_only', 'partial');
exception
  when duplicate_object then null;
end $$;

-- Add amount_paid: actual amount collected (may differ from amount_due for partial/interest_only)
alter table payments
  add column if not exists amount_paid numeric(12, 2),
  add column if not exists collection_type payment_collection_type;
