-- SK4 🐞 (07.11.2026): visits could not be deleted after 20261109000000_stock_changes.sql.
-- The BEFORE DELETE trigger on visits returned NULL, which in PostgreSQL silently cancels the delete.
-- The function now returns the row (OLD for a delete, NEW for an update), so the delete goes ahead.
-- Run once in Supabase SQL Editor after 20261109000000_stock_changes.sql. Safe to run more than once.
-- Only replaces one trigger function. Nothing is changed or deleted.

select backup.take_snapshot('før migrering 20261110000000_fix_visit_delete.sql');

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
  -- A BEFORE trigger must return the row, or the delete is cancelled.
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function private.log_visit_change() from public, anon, authenticated;
