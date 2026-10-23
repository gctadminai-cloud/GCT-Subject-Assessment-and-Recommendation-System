-- ============================================================
-- SCHEMA ADDITION — run this in the Supabase SQL editor
-- (after supabase/schema.sql). Safe to run multiple times.
--
-- Adds `bulk_imported` to accounts: true = this login was seeded
-- from the registrar's Excel file (backend/scripts/seedStudentsFromExcel.js).
-- backend/cron/weeklyReset.js now SKIPS any account where
-- bulk_imported = true, so those 250 legacy logins never get wiped
-- by the weekly reset job.
-- ============================================================

alter table public.accounts
  add column if not exists bulk_imported boolean not null default false;

create index if not exists idx_accounts_bulk_imported on public.accounts(bulk_imported);
