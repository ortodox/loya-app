-- FK1–FK4: photos the client sends (progress), in the client card – cosmetology after «Визиты»,
-- photos during a treatment course in «Лечение» (course_id set).
-- Run once in Supabase SQL Editor after 20261102000000_export.sql. Safe to run more than once.
-- Only adds one table, its policies and the table to the snapshot. Nothing is changed or deleted.
-- Files use the existing private bucket «visit-photos» under <doctor_id>/client-photos/<client_id>/
-- (policies from 20261027000000_visit_items.sql).

select backup.take_snapshot('før migrering 20261103000000_client_photos.sql');

create table if not exists public.client_photos (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null default auth.uid(),
  client_id uuid not null,
  course_id uuid,                                       -- FK3: taken during this treatment course
  taken_on date not null,                               -- FK2: when the photo was taken (editable)
  storage_path text not null unique,                    -- <doctor_id>/client-photos/<client_id>/<file> in «visit-photos»
  created_at timestamptz not null default now(),
  foreign key (client_id, doctor_id) references public.clients (id, doctor_id) on delete cascade,
  foreign key (course_id, doctor_id) references public.treatment_courses (id, doctor_id) on delete set null (course_id),
  check (storage_path like doctor_id::text || '/client-photos/' || client_id::text || '/%')
);

create index if not exists client_photos_client_idx on public.client_photos (client_id, taken_on desc);
create index if not exists client_photos_course_idx on public.client_photos (course_id);

-- Row Level Security: owner only, and only after TOTP (aal2) -----------------------------------
alter table public.client_photos enable row level security;

revoke all on public.client_photos from anon;
grant select, insert, update, delete on public.client_photos to authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'client_photos' and policyname = 'client_photos: owner') then
    create policy "client_photos: owner" on public.client_photos for all to authenticated
      using (doctor_id = (select auth.uid())) with check (doctor_id = (select auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'client_photos' and policyname = 'client_photos: require mfa') then
    create policy "client_photos: require mfa" on public.client_photos as restrictive for all to authenticated
      using ((select auth.jwt() ->> 'aal') = 'aal2') with check ((select auth.jwt() ->> 'aal') = 'aal2');
  end if;
end;
$$;

-- Backup: snapshots also cover client photo rows (not the files) -------------------------------
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
  select snapshot_time, take_snapshot.reason, 'client_care_photos', to_jsonb(r) from public.client_care_photos r;
  get diagnostics n = row_count; copied := copied + n;

  insert into backup.snapshots (taken_at, reason, table_name, row_data)
  select snapshot_time, take_snapshot.reason, 'client_documents', to_jsonb(r) from public.client_documents r;
  get diagnostics n = row_count; copied := copied + n;

  insert into backup.snapshots (taken_at, reason, table_name, row_data)
  select snapshot_time, take_snapshot.reason, 'client_photos', to_jsonb(r) from public.client_photos r;
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
