-- MVP 1c, task 1c-2: «Уход» (UH1, UH2) and «Документы и анализы» (DK1, DK3, DK5, LE8).
-- Run once in Supabase SQL Editor after 20261030000000_treatment_courses.sql. Safe to run more than once.
-- Only adds: columns, two tables, policies, one storage bucket. Nothing is changed or deleted.
-- Care photos use the existing private bucket «visit-photos» under <doctor_id>/care/<client_id>/ (policies
-- from 20261027000000_visit_items.sql). Documents get their own private bucket «client-documents».

select backup.take_snapshot('før migrering 20261031000000_care_documents.sql');

-- UH1: the client's home care, written by the doctor, and when it was last changed.
alter table public.clients
  add column if not exists care_text text,
  add column if not exists care_updated_at date;

-- UH2: photos in «Уход» (products, scheme).
create table if not exists public.client_care_photos (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null default auth.uid(),
  client_id uuid not null,
  storage_path text not null unique,                    -- <doctor_id>/care/<client_id>/<file> in «visit-photos»
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  foreign key (client_id, doctor_id) references public.clients (id, doctor_id) on delete cascade,
  check (storage_path like doctor_id::text || '/care/' || client_id::text || '/%')
);

create index if not exists client_care_photos_client_idx on public.client_care_photos (client_id, sort_order);

-- DK1/LE8: files the client sends (lab results, conclusions, photos, PDF), optionally tied to a course.
create table if not exists public.client_documents (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null default auth.uid(),
  client_id uuid not null,
  course_id uuid,                                       -- LE8: «Прикрепить к курсу»
  title text check (length(title) <= 200),
  document_date date not null,
  storage_path text not null unique,                    -- <doctor_id>/<client_id>/<file> in «client-documents»
  mime_type text not null check (mime_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp')),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 20971520),
  created_at timestamptz not null default now(),
  foreign key (client_id, doctor_id) references public.clients (id, doctor_id) on delete cascade,
  foreign key (course_id, doctor_id) references public.treatment_courses (id, doctor_id) on delete set null (course_id),
  check (storage_path like doctor_id::text || '/' || client_id::text || '/%')
);

create index if not exists client_documents_client_idx on public.client_documents (client_id, document_date desc);
create index if not exists client_documents_course_idx on public.client_documents (course_id);

-- Row Level Security: owner only, and only after TOTP (aal2) -----------------------------------
alter table public.client_care_photos enable row level security;
alter table public.client_documents enable row level security;

revoke all on public.client_care_photos, public.client_documents from anon;
grant select, insert, update, delete on public.client_care_photos, public.client_documents to authenticated;

do $$
declare
  t text;
begin
  foreach t in array array['client_care_photos', 'client_documents'] loop
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

-- Supabase Storage: private bucket for documents, images and PDF up to 20 MB -----------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('client-documents', 'client-documents', false, 20971520,
        array['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp'])
on conflict (id) do nothing;

do $$
begin
  -- Owner only: the first folder of the path is the doctor's user id.
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'client-documents: owner') then
    create policy "client-documents: owner" on storage.objects for all to authenticated
      using (bucket_id = 'client-documents' and (storage.foldername(name))[1] = (select auth.uid())::text)
      with check (bucket_id = 'client-documents' and (storage.foldername(name))[1] = (select auth.uid())::text);
  end if;
  -- Only after TOTP. Restrictive policies apply to every bucket, so leave other buckets alone.
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'client-documents: require mfa') then
    create policy "client-documents: require mfa" on storage.objects as restrictive for all to authenticated
      using (bucket_id <> 'client-documents' or (select auth.jwt() ->> 'aal') = 'aal2')
      with check (bucket_id <> 'client-documents' or (select auth.jwt() ->> 'aal') = 'aal2');
  end if;
end;
$$;

-- Backup: snapshots also cover care photo rows and document rows (not the files) -------------
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
