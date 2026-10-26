-- MVP 1b, task 1b-2: a visit as Loya wants it (R1, DO1, LOT1, R2, P5, P9, AL1, H1, PP1).
-- Run once in Supabase SQL Editor after 20261026000000_catalog.sql. Safe to run more than once.
-- Only adds: new tables, columns, policies and a storage bucket. Old columns
-- (visits.home_care_recommendations, visits.procedure_plan) are kept and shown as «Архив».

select backup.take_snapshot('før migrering 20261027000000_visit_items.sql');

-- New columns --------------------------------------------------------------------------------
alter table public.visits
  add column if not exists notes text,                 -- R2: internal, never shown to the client
  add column if not exists recommendations text,       -- P5: post-procedure advice, one per line
  add column if not exists recommendations_lang text;  -- language the advice was written in

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'visits_recommendations_lang_check') then
    alter table public.visits add constraint visits_recommendations_lang_check
      check (recommendations_lang in ('ru', 'uk', 'pl', 'en'));
  end if;
  -- Lets visit_items / visit_photos reference (id, doctor_id), like visits → clients.
  if not exists (select 1 from pg_constraint where conname = 'visits_id_doctor_id_key') then
    alter table public.visits add constraint visits_id_doctor_id_key unique (id, doctor_id);
  end if;
end;
$$;

-- PP1: the procedure plan belongs to the client, not to one visit.
alter table public.clients add column if not exists procedure_plan text;

-- visit_items: one row per preparation used in the visit (R1, DO1, P9) ------------------------
create table if not exists public.visit_items (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null default auth.uid(),
  visit_id uuid not null,
  preparation_id uuid,                                  -- null if the preparation is gone
  preparation_name text not null check (length(btrim(preparation_name)) > 0),  -- copy at visit time
  procedure_type_id uuid,                               -- copy at visit time
  quantity text,                                        -- DO1: free text, e.g. «20+15 ед.»
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (visit_id, doctor_id) references public.visits (id, doctor_id) on delete cascade,
  foreign key (preparation_id, doctor_id) references public.preparations (id, doctor_id),
  foreign key (procedure_type_id, doctor_id) references public.procedure_types (id, doctor_id)
);

create index if not exists visit_items_visit_idx on public.visit_items (visit_id, sort_order);

create or replace trigger visit_items_set_updated_at
  before update on public.visit_items for each row execute function public.set_updated_at();

-- visit_photos: photos of the preparation stickers, at most 3 per visit (LOT1) ----------------
create table if not exists public.visit_photos (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null default auth.uid(),
  visit_id uuid not null,
  storage_path text not null unique,                    -- <doctor_id>/<visit_id>/<file> in «visit-photos»
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  foreign key (visit_id, doctor_id) references public.visits (id, doctor_id) on delete cascade,
  check (storage_path like doctor_id::text || '/' || visit_id::text || '/%')
);

create index if not exists visit_photos_visit_idx on public.visit_photos (visit_id, sort_order);

create or replace function public.visit_photos_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- A row that already exists (e.g. restored from a backup with «on conflict do nothing») is not a new photo.
  if exists (select 1 from public.visit_photos where id = new.id) then
    return new;
  end if;
  if (select count(*) from public.visit_photos where visit_id = new.visit_id) >= 3 then
    raise exception 'A visit can have at most 3 photos' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create or replace trigger visit_photos_max_3
  before insert on public.visit_photos for each row execute function public.visit_photos_limit();

-- Row Level Security: owner only, and only after TOTP (aal2) -----------------------------------
alter table public.visit_items enable row level security;
alter table public.visit_photos enable row level security;

revoke all on public.visit_items, public.visit_photos from anon;
grant select, insert, update, delete on public.visit_items, public.visit_photos to authenticated;

do $$
declare
  t text;
begin
  foreach t in array array['visit_items', 'visit_photos'] loop
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

-- Copy existing data into the new places (nothing is deleted) ---------------------------------
-- a) Home-care advice of old visits becomes the visit's recommendations.
update public.visits
set recommendations = home_care_recommendations
where recommendations is null
  and btrim(coalesce(home_care_recommendations, '')) <> '';

-- b) The client's procedure plan = the plan from the client's newest visit that has one.
update public.clients c
set procedure_plan = latest.procedure_plan
from (
  select distinct on (v.client_id) v.client_id, v.procedure_plan
  from public.visits v
  where btrim(coalesce(v.procedure_plan, '')) <> ''
  order by v.client_id, v.visit_date desc, v.created_at desc
) latest
where latest.client_id = c.id
  and c.procedure_plan is null;

-- Supabase Storage: private bucket for sticker photos -----------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('visit-photos', 'visit-photos', false, 1258291, array['image/jpeg'])
on conflict (id) do nothing;

do $$
begin
  -- Owner only: the first folder of the path is the doctor's user id.
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'visit-photos: owner') then
    create policy "visit-photos: owner" on storage.objects for all to authenticated
      using (bucket_id = 'visit-photos' and (storage.foldername(name))[1] = (select auth.uid())::text)
      with check (bucket_id = 'visit-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
  end if;
  -- Only after TOTP. Restrictive policies apply to every bucket, so leave other buckets alone.
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'visit-photos: require mfa') then
    create policy "visit-photos: require mfa" on storage.objects as restrictive for all to authenticated
      using (bucket_id <> 'visit-photos' or (select auth.jwt() ->> 'aal') = 'aal2')
      with check (bucket_id <> 'visit-photos' or (select auth.jwt() ->> 'aal') = 'aal2');
  end if;
end;
$$;

-- Backup: snapshots also cover visit items and photo rows (not the image files) ---------------
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
