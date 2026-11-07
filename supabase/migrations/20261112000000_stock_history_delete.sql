-- SK8 (approved 07.11.2026): a line in «История» of a preparation can be deleted for good, with no
-- effect on the stock. A change-log line (✎) is deleted from stock_changes; a line made from a visit,
-- receipt or correction is only taken out of «История» (stock_history_hidden) – the visit, receipt or
-- correction itself stays, so «В наличии» does not change. There is no way to show a removed line again.
-- Run once in Supabase SQL Editor after 20261111000000_stock_changes_client.sql. Safe to run more than once.
-- Adds one table, its policies, and lets the owner delete her own change-log rows (until now read-only).
-- No client data is changed or deleted by this migration.

select backup.take_snapshot('før migrering 20261112000000_stock_history_delete.sql');

-- The owner may delete her own change-log rows (only after TOTP).
grant delete on public.stock_changes to authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'stock_changes' and policyname = 'stock_changes: owner deletes') then
    create policy "stock_changes: owner deletes" on public.stock_changes for delete to authenticated
      using (doctor_id = (select auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'stock_changes' and policyname = 'stock_changes: require mfa to delete') then
    create policy "stock_changes: require mfa to delete" on public.stock_changes as restrictive for delete to authenticated
      using ((select auth.jwt() ->> 'aal') = 'aal2');
  end if;
end;
$$;

-- Lines of «История» made from visits, receipts and corrections that were removed from the view.
create table if not exists public.stock_history_hidden (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null default auth.uid(),
  stock_item_id uuid not null,
  line_key text not null,                               -- «visit:<visit id>», «receipt:<id>», «adjustment:<id>»
  created_at timestamptz not null default now(),
  unique (doctor_id, stock_item_id, line_key),
  foreign key (stock_item_id, doctor_id) references public.stock_items (id, doctor_id) on delete cascade
);

alter table public.stock_history_hidden enable row level security;
revoke all on public.stock_history_hidden from anon;
grant select, insert on public.stock_history_hidden to authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'stock_history_hidden' and policyname = 'stock_history_hidden: owner') then
    create policy "stock_history_hidden: owner" on public.stock_history_hidden for all to authenticated
      using (doctor_id = (select auth.uid())) with check (doctor_id = (select auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'stock_history_hidden' and policyname = 'stock_history_hidden: require mfa') then
    create policy "stock_history_hidden: require mfa" on public.stock_history_hidden as restrictive for all to authenticated
      using ((select auth.jwt() ->> 'aal') = 'aal2') with check ((select auth.jwt() ->> 'aal') = 'aal2');
  end if;
end;
$$;

-- Backup: snapshots also cover the removed lines --------------------------------------------------
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

  insert into backup.snapshots (taken_at, reason, table_name, row_data)
  select snapshot_time, take_snapshot.reason, 'stock_changes', to_jsonb(r) from public.stock_changes r;
  get diagnostics n = row_count; copied := copied + n;

  insert into backup.snapshots (taken_at, reason, table_name, row_data)
  select snapshot_time, take_snapshot.reason, 'stock_history_hidden', to_jsonb(r) from public.stock_history_hidden r;
  get diagnostics n = row_count; copied := copied + n;

  return copied;
end;
$$;

revoke all on function backup.take_snapshot(text) from public, anon, authenticated;
