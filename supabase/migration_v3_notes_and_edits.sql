-- Run this in Supabase SQL Editor (patch on top of migration_v2)

-- Add note field to payments
alter table payments
  add column if not exists note text;
