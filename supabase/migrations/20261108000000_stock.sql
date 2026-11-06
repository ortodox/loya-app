-- SK1 «Склад» (approved 06.11.2026): the doctor chooses which preparations are kept in stock,
-- records receipts (botox in vials of its own sizes, the rest in pieces) and corrections; what is
-- left is worked out by the app from receipts, corrections and the visits since stock-keeping began
-- (nothing is stored per visit). No client data in these tables.
-- Run once in Supabase SQL Editor after 20261107000000_archive_downloads.sql. Safe to run more than once.
-- Only adds three tables, their policies and the tables to the snapshot. Nothing is changed or deleted.

select backup.take_snapshot('før migrering 20261108000000_stock.sql');

-- A preparation kept in stock: since when (visits from that day count), and the vial sizes for botox.
create table if not exists public.stock_items (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null default auth.uid(),
  preparation_id uuid not null,
  started_on date not null,
  vial_sizes integer[],                                 -- botox: e.g. {50,100,200}; null = counted in pieces
  created_at timestamptz not null default now(),
  unique (id, doctor_id),
  unique (doctor_id, preparation_id),
  foreign key (preparation_id, doctor_id) references public.preparations (id, doctor_id) on delete cascade,
  check (vial_sizes is null or (cardinality(vial_sizes) > 0 and 0 < all (vial_sizes)))
);

-- «+ Поступление»: vials of one size (botox) or pieces; an already opened vial when stock-keeping begins.
create table if not exists public.stock_receipts (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null default auth.uid(),
  stock_item_id uuid not null,
  received_on date not null,
  vial_size integer check (vial_size is null or vial_size > 0),
  count integer not null check (count > 0 and count <= 1000),
  opened_on date,
  remaining numeric check (remaining is null or remaining >= 0),
  lot text,
  expires_on date,
  created_at timestamptz not null default now(),
  foreign key (stock_item_id, doctor_id) references public.stock_items (id, doctor_id) on delete cascade
);

-- «Списать остаток» (discard a vial) and «Исправить остаток» (set what is left).
create table if not exists public.stock_adjustments (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null default auth.uid(),
  stock_item_id uuid not null,
  happened_on date not null,
  kind text not null check (kind in ('discard', 'set')),
  vial_key text,                                        -- which vial (botox); null for pieces
  amount numeric check (amount is null or amount >= 0),
  created_at timestamptz not null default now(),
  foreign key (stock_item_id, doctor_id) references public.stock_items (id, doctor_id) on delete cascade
);

create index if not exists stock_receipts_item_idx on public.stock_receipts (stock_item_id, received_on);
create index if not exists stock_adjustments_item_idx on public.stock_adjustments (stock_item_id, happened_on);

-- Row Level Security: owner only, and only after TOTP (aal2) -----------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['stock_items', 'stock_receipts', 'stock_adjustments'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = t || ': owner') then
      execute format('create policy %I on public.%I for all to authenticated using (doctor_id = (select auth.uid())) with check (doctor_id = (select auth.uid()))', t || ': owner', t);
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = t || ': require mfa') then
      execute format('create policy %I on public.%I as restrictive for all to authenticated using ((select auth.jwt() ->> ''aal'') = ''aal2'') with check ((select auth.jwt() ->> ''aal'') = ''aal2'')', t || ': require mfa', t);
    end if;
  end loop;
end;
$$;

-- Backup: snapshots also cover the stock tables ---------------------------------------------------
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

  insert into backup.snapshots (taken_at, reason, table_name, row_data)
  select snapshot_time, take_snapshot.reason, 'stock_items', to_jsonb(r) from public.stock_items r;
  get diagnostics n = row_count; copied := copied + n;

  insert into backup.snapshots (taken_at, reason, table_name, row_data)
  select snapshot_time, take_snapshot.reason, 'stock_receipts', to_jsonb(r) from public.stock_receipts r;
  get diagnostics n = row_count; copied := copied + n;

  insert into backup.snapshots (taken_at, reason, table_name, row_data)
  select snapshot_time, take_snapshot.reason, 'stock_adjustments', to_jsonb(r) from public.stock_adjustments r;
  get diagnostics n = row_count; copied := copied + n;

  return copied;
end;
$$;

revoke all on function backup.take_snapshot(text) from public, anon, authenticated;
