-- SK4 «журнал изменений» (approved 07.11.2026): every change that can move the stock of a
-- preparation kept in stock is written automatically by the database – a visit's quantity, date or
-- preparation changed, a visit deleted, a receipt or correction changed or deleted. The app only
-- reads the log («История ▾»); nobody can edit or delete it from the app. No client names: only the
-- visit's id and date.
-- Run once in Supabase SQL Editor after 20261108000000_stock.sql. Safe to run more than once.
-- Only adds one table, its policies, trigger functions and triggers, and the table to the snapshot.
-- Nothing is changed or deleted. The log starts on the day this migration is run.

select backup.take_snapshot('før migrering 20261109000000_stock_changes.sql');

create table if not exists public.stock_changes (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null,
  preparation_id uuid not null,
  changed_at timestamptz not null default clock_timestamp(),  -- order within one save
  source text not null check (source in ('visit_item', 'visit', 'receipt', 'adjustment')),
  action text not null check (action in ('insert', 'update', 'delete')),
  visit_id uuid,                                        -- no foreign key: the visit may be deleted
  visit_date date,                                      -- the visit's date (before a date change)
  new_visit_date date,                                  -- after a date change
  old_quantity text,                                    -- the quantity as typed, before
  new_quantity text,                                    -- … and after
  old_data jsonb,                                       -- receipts and corrections: the row before
  new_data jsonb,                                       -- … and after
  foreign key (preparation_id, doctor_id) references public.preparations (id, doctor_id) on delete cascade
);

create index if not exists stock_changes_preparation_idx on public.stock_changes (preparation_id, changed_at desc);

-- Row Level Security: the owner may only read (after TOTP); rows come from the triggers below.
alter table public.stock_changes enable row level security;
revoke all on public.stock_changes from anon, authenticated;
grant select on public.stock_changes to authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'stock_changes' and policyname = 'stock_changes: owner reads') then
    create policy "stock_changes: owner reads" on public.stock_changes for select to authenticated
      using (doctor_id = (select auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'stock_changes' and policyname = 'stock_changes: require mfa') then
    create policy "stock_changes: require mfa" on public.stock_changes as restrictive for select to authenticated
      using ((select auth.jwt() ->> 'aal') = 'aal2');
  end if;
end;
$$;

create schema if not exists private;

-- Is this preparation kept in stock by this doctor?
create or replace function private.in_stock(p_doctor uuid, p_preparation uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_preparation is not null
     and exists (select 1 from public.stock_items s where s.doctor_id = p_doctor and s.preparation_id = p_preparation);
$$;

-- A preparation row of a visit added, changed or removed. When the whole visit is deleted, the
-- visit trigger below has already written one line per preparation, so nothing is written here.
create or replace function private.log_visit_item_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_date date;
begin
  if tg_op in ('UPDATE', 'DELETE') and private.in_stock(old.doctor_id, old.preparation_id) then
    select visit_date into v_date from public.visits where id = old.visit_id;
    if found and (tg_op = 'DELETE' or old.preparation_id is distinct from new.preparation_id or old.quantity is distinct from new.quantity) then
      insert into public.stock_changes (doctor_id, preparation_id, source, action, visit_id, visit_date, old_quantity, new_quantity)
      values (old.doctor_id, old.preparation_id, 'visit_item', case when tg_op = 'DELETE' or old.preparation_id is distinct from new.preparation_id then 'delete' else 'update' end,
              old.visit_id, v_date, old.quantity, case when tg_op = 'UPDATE' and old.preparation_id is not distinct from new.preparation_id then new.quantity end);
    end if;
  end if;
  if tg_op in ('INSERT', 'UPDATE') and private.in_stock(new.doctor_id, new.preparation_id)
     and (tg_op = 'INSERT' or old.preparation_id is distinct from new.preparation_id) then
    select visit_date into v_date from public.visits where id = new.visit_id;
    insert into public.stock_changes (doctor_id, preparation_id, source, action, visit_id, visit_date, new_quantity)
    values (new.doctor_id, new.preparation_id, 'visit_item', 'insert', new.visit_id, v_date, new.quantity);
  end if;
  return null;
end;
$$;

-- A visit's date changed, or the visit deleted: one line per preparation kept in stock.
create or replace function private.log_visit_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and old.visit_date is distinct from new.visit_date then
    insert into public.stock_changes (doctor_id, preparation_id, source, action, visit_id, visit_date, new_visit_date, old_quantity, new_quantity)
    select old.doctor_id, i.preparation_id, 'visit', 'update', old.id, old.visit_date, new.visit_date, i.quantity, i.quantity
    from public.visit_items i
    where i.visit_id = old.id and private.in_stock(old.doctor_id, i.preparation_id);
  elsif tg_op = 'DELETE' then
    insert into public.stock_changes (doctor_id, preparation_id, source, action, visit_id, visit_date, old_quantity)
    select old.doctor_id, i.preparation_id, 'visit', 'delete', old.id, old.visit_date, i.quantity
    from public.visit_items i
    where i.visit_id = old.id and private.in_stock(old.doctor_id, i.preparation_id);
  end if;
  return null;
end;
$$;

-- A receipt or correction changed or deleted (the app only adds them; added ones are already in «История»).
create or replace function private.log_stock_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_preparation uuid;
begin
  select s.preparation_id into v_preparation from public.stock_items s where s.id = old.stock_item_id;
  if not found then
    return null;                                        -- the whole preparation was taken off stock
  end if;
  insert into public.stock_changes (doctor_id, preparation_id, source, action, old_data, new_data)
  values (old.doctor_id, v_preparation, case when tg_table_name = 'stock_receipts' then 'receipt' else 'adjustment' end,
          lower(tg_op), to_jsonb(old) - 'doctor_id', case when tg_op = 'UPDATE' then to_jsonb(new) - 'doctor_id' end);
  return null;
end;
$$;

revoke all on function private.in_stock(uuid, uuid) from public, anon, authenticated;
revoke all on function private.log_visit_item_change() from public, anon, authenticated;
revoke all on function private.log_visit_change() from public, anon, authenticated;
revoke all on function private.log_stock_row_change() from public, anon, authenticated;

-- The visit trigger runs BEFORE delete so it still sees the visit's preparations.
create or replace trigger visits_log_stock_delete
  before delete on public.visits for each row execute function private.log_visit_change();
create or replace trigger visits_log_stock_date
  after update of visit_date on public.visits for each row execute function private.log_visit_change();
create or replace trigger visit_items_log_stock
  after insert or update or delete on public.visit_items for each row execute function private.log_visit_item_change();
create or replace trigger stock_receipts_log
  after update or delete on public.stock_receipts for each row execute function private.log_stock_row_change();
create or replace trigger stock_adjustments_log
  after update or delete on public.stock_adjustments for each row execute function private.log_stock_row_change();

-- Backup: snapshots also cover the change log --------------------------------------------------
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

  return copied;
end;
$$;

revoke all on function backup.take_snapshot(text) from public, anon, authenticated;
