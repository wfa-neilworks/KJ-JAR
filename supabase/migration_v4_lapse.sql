-- Run this in Supabase SQL Editor (patch on top of migration_v3)

-- Add 'lapsed' to collection type enum
alter type payment_collection_type add value if not exists 'lapsed';

-- lapsed_at: when the lapse was recorded (payment stays unpaid/collectible)
alter table payments
  add column if not exists lapsed_at timestamptz;

-- is_lapse_fee: marks the standalone interest-debt row created on lapse
alter table payments
  add column if not exists is_lapse_fee boolean not null default false;
