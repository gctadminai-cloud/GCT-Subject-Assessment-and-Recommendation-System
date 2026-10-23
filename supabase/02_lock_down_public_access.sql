-- Run once on an existing Supabase project after confirming the backend has
-- SUPABASE_SERVICE_ROLE_KEY configured. Backend requests use service_role;
-- anon/authenticated clients receive no table privileges or RLS policies.
begin;

alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.students enable row level security;
alter table public.subjects enable row level security;
alter table public.prerequisites enable row level security;
alter table public.academic_records enable row level security;
alter table public.recommendations enable row level security;
alter table public.settings enable row level security;
alter table public.chat_logs enable row level security;
alter table public.grade_records enable row level security;

drop policy if exists "Public access for profiles" on public.profiles;
drop policy if exists "Public access for accounts" on public.accounts;
drop policy if exists "Public access for students" on public.students;
drop policy if exists "Public access for subjects" on public.subjects;
drop policy if exists "Public access for prerequisites" on public.prerequisites;
drop policy if exists "Public access for academic_records" on public.academic_records;
drop policy if exists "Public access for recommendations" on public.recommendations;
drop policy if exists "Public access for settings" on public.settings;
drop policy if exists "Public access for chat_logs" on public.chat_logs;
drop policy if exists "Public access for grade_records" on public.grade_records;

revoke all privileges on table
    public.profiles,
    public.accounts,
    public.students,
    public.subjects,
    public.prerequisites,
    public.academic_records,
    public.recommendations,
    public.settings,
    public.chat_logs,
    public.grade_records
from anon, authenticated;

alter default privileges in schema public
    revoke all on tables from anon, authenticated;

commit;