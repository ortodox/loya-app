-- MVP 1c, task 1c-1: direction (DM1) and treatment courses (LE1–LE6, LE9).
-- Run once in Supabase SQL Editor after 20261029000000_anamnesis_confirmed.sql. Safe to run more than once.
-- Only adds: one column, two tables, policies. Nothing is changed or deleted.
-- Prescription photos use the existing private bucket «visit-photos» under <doctor_id>/courses/<course_id>/,
-- so the storage policies from 20261027000000_visit_items.sql (owner + aal2) already cover them.

select backup.take_snapshot('før migrering 20261030000000_treatment_courses.sql');

-- DM1: «Косметология», «Дерматология» or both. Null = not set yet.
alter table public.clients add column if not exists direction text[];

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'clients_direction_check') then
    alter table public.clients add constraint clients_direction_check
      check (direction <@ array['cosmetology', 'dermatology']::text[]);
  end if;
end;
$$;

-- LE1: a treatment course. A client can have several over time.
create table if not exists public.treatment_courses (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null default auth.uid(),
  client_id uuid not null,
  diagnosis text not null check (length(btrim(diagnosis)) > 0),
  prescription text,                                    -- what, how much, which scheme (free text)
  start_date date not null,
  end_date date not null check (end_date >= start_date), -- approximate end
  lab_interval_value numeric check (lab_interval_value > 0), -- LE6: e.g. 2.5
  lab_interval_unit text check (lab_interval_unit in ('days', 'weeks', 'months')),
  last_lab_date date,                                   -- LE6: «Анализы сданы ✓»
  status text not null default 'active' check (status in ('active', 'completed')),
  completed_at date,                                    -- LE9: «Завершить курс»
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, doctor_id),
  foreign key (client_id, doctor_id) references public.clients (id, doctor_id) on delete cascade,
  check ((lab_interval_value is null) = (lab_interval_unit is null))
);

create index if not exists treatment_courses_client_idx on public.treatment_courses (client_id, start_date desc);

create or replace trigger treatment_courses_set_updated_at
  before update on public.treatment_courses for each row execute function public.set_updated_at();

-- LE3: photos of prescriptions, added at the start and at every renewal.
create table if not exists public.course_photos (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null default auth.uid(),
  course_id uuid not null,
  storage_path text not null unique,                    -- <doctor_id>/courses/<course_id>/<file> in «visit-photos»
  created_at timestamptz not null default now(),
  foreign key (course_id, doctor_id) references public.treatment_courses (id, doctor_id) on delete cascade,
  check (storage_path like doctor_id::text || '/courses/' || course_id::text || '/%')
);

create index if not exists course_photos_course_idx on public.course_photos (course_id, created_at desc);

-- Row Level Security: owner only, and only after TOTP (aal2) -----------------------------------
alter table public.treatment_courses enable row level security;
alter table public.course_photos enable row level security;

revoke all on public.treatment_courses, public.course_photos from anon;
grant select, insert, update, delete on public.treatment_courses, public.course_photos to authenticated;

do $$
declare
  t text;
begin
  foreach t in array array['treatment_courses', 'course_photos'] loop
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = t || ': owner') then
      execute format(
        'create policy %I on public.%I for all to authenticated
           using (doctor_id = (select auth.uid())) with check (doctor_id = (select auth.uid()))',
        t || ': owner', t);
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = t || ': require mfa') then
      execute format(
        'create policy %I on public.%I as restrictive for all to authenticated
           using ((select auth.jwt() ->> ''aal'') = ''aal2'') with check ((select auth.jwt() ->> ''aal'') = ''aal2'')',
        t || ': require mfa', t);
    end if;
  end loop;
end;
$$;

-- Backup: snapshots also cover the courses and their photo rows (not the image files) ---------
create or replace function backup.take_snapshot(reason text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  snapshot_time timestamptz := clock_timestamp();
  copied integer := 0;
  n integer;
begin
  insert into backup.snapshots (taken_at, reason, table_name, row_data)
  select snapshot_time, take_snapshot.reason, 'clients', to_jsonb(r) from public.clients r;
  get diagnostics n = row_count; copied := copied + n;

  insert into backup.snapshots (taken_at, reason, table_name, row_data)
  select snapshot_time, take_snapshot.reason, 'visits', to_jsonb(r) from public.visits r;
  get diagnostics n = row_count; copied := copied + n;

  insert into backup.snapshots (taken_at, reason, table_name, row_data)
  select snapshot_time, take_snapshot.reason, 'visit_items', to_jsonb(r) from public.visit_items r;
  get diagnostics n = row_count; copied := copied + n;

  insert into backup.snapshots (taken_at, reason, table_name, row_data)
  select snapshot_time, take_snapshot.reason, 'visit_photos', to_jsonb(r) from public.visit_photos r;
  get diagnostics n = row_count; copied := copied + n;

  insert into backup.snapshots (taken_at, reason, table_name, row_data)
  select snapshot_time, take_snapshot.reason, 'treatment_courses', to_jsonb(r) from public.treatment_courses r;
  get diagnostics n = row_count; copied := copied + n;

  insert into backup.snapshots (taken_at, reason, table_name, row_data)
  select snapshot_time, take_snapshot.reason, 'course_photos', to_jsonb(r) from public.course_photos r;
  get diagnostics n = row_count; copied := copied + n;

  insert into backup.snapshots (taken_at, reason, table_name, row_data)
  select snapshot_time, take_snapshot.reason, 'zones', to_jsonb(r) from public.zones r;
  get diagnostics n = row_count; copied := copied + n;

  insert into backup.snapshots (taken_at, reason, table_name, row_data)
  select snapshot_time, take_snapshot.reason, 'procedure_types', to_jsonb(r) from public.procedure_types r;
  get diagnostics n = row_count; copied := copied + n;

  insert into backup.snapshots (taken_at, reason, table_name, row_data)
  select snapshot_time, take_snapshot.reason, 'procedure_type_zones', to_jsonb(r) from public.procedure_type_zones r;
  get diagnostics n = row_count; copied := copied + n;

  insert into backup.snapshots (taken_at, reason, table_name, row_data)
  select snapshot_time, take_snapshot.reason, 'preparations', to_jsonb(r) from public.preparations r;
  get diagnostics n = row_count; copied := copied + n;

  return copied;
end;
$$;

revoke all on function backup.take_snapshot(text) from public, anon, authenticated;
