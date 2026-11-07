-- SK7 (approved 07.11.2026): «История» of a preparation shows the client of each visit, and the name
-- opens the client card. The change log now remembers the client, so even a deleted visit can show
-- whose it was. The client's name is never stored here – only the id; the app looks the name up.
-- Run once in Supabase SQL Editor after 20261110000000_fix_visit_delete.sql. Safe to run more than once.
-- Only adds one column and replaces two trigger functions. Nothing is changed or deleted.
-- Changes logged before this migration have no client (shown without a name).

select backup.take_snapshot('før migrering 20261111000000_stock_changes_client.sql');

alter table public.stock_changes add column if not exists client_id uuid;   -- no foreign key: the client may be deleted

create or replace function private.log_visit_item_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_date date;
  v_client uuid;
begin
  if tg_op in ('UPDATE', 'DELETE') and private.in_stock(old.doctor_id, old.preparation_id) then
    select visit_date, client_id into v_date, v_client from public.visits where id = old.visit_id;
    if found and (tg_op = 'DELETE' or old.preparation_id is distinct from new.preparation_id or old.quantity is distinct from new.quantity) then
      insert into public.stock_changes (doctor_id, preparation_id, source, action, visit_id, client_id, visit_date, old_quantity, new_quantity)
      values (old.doctor_id, old.preparation_id, 'visit_item', case when tg_op = 'DELETE' or old.preparation_id is distinct from new.preparation_id then 'delete' else 'update' end,
              old.visit_id, v_client, v_date, old.quantity, case when tg_op = 'UPDATE' and old.preparation_id is not distinct from new.preparation_id then new.quantity end);
    end if;
  end if;
  if tg_op in ('INSERT', 'UPDATE') and private.in_stock(new.doctor_id, new.preparation_id)
     and (tg_op = 'INSERT' or old.preparation_id is distinct from new.preparation_id) then
    select visit_date, client_id into v_date, v_client from public.visits where id = new.visit_id;
    insert into public.stock_changes (doctor_id, preparation_id, source, action, visit_id, client_id, visit_date, new_quantity)
    values (new.doctor_id, new.preparation_id, 'visit_item', 'insert', new.visit_id, v_client, v_date, new.quantity);
  end if;
  return null;
end;
$$;

create or replace function private.log_visit_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and old.visit_date is distinct from new.visit_date then
    insert into public.stock_changes (doctor_id, preparation_id, source, action, visit_id, client_id, visit_date, new_visit_date, old_quantity, new_quantity)
    select old.doctor_id, i.preparation_id, 'visit', 'update', old.id, old.client_id, old.visit_date, new.visit_date, i.quantity, i.quantity
    from public.visit_items i
    where i.visit_id = old.id and private.in_stock(old.doctor_id, i.preparation_id);
  elsif tg_op = 'DELETE' then
    insert into public.stock_changes (doctor_id, preparation_id, source, action, visit_id, client_id, visit_date, old_quantity)
    select old.doctor_id, i.preparation_id, 'visit', 'delete', old.id, old.client_id, old.visit_date, i.quantity
    from public.visit_items i
    where i.visit_id = old.id and private.in_stock(old.doctor_id, i.preparation_id);
  end if;
  -- A BEFORE trigger must return the row, or the delete is cancelled (20261110000000_fix_visit_delete.sql).
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function private.log_visit_item_change() from public, anon, authenticated;
revoke all on function private.log_visit_change() from public, anon, authenticated;
