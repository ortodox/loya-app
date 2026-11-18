-- MG16 (approved 18.11.2026): reserved products in «Магазин» – Loya decides who gets a piece.
-- A piece taken by an order that is not handed over yet is «отложено» for that buyer. These functions
-- move one piece at a time: give a free piece to an order, take one back (it becomes free again, e.g. to
-- sell it to someone else – the order then waits for the next delivery), or move it from one order to
-- another. Payments are never touched; the stock never goes below zero.
-- Run once in Supabase SQL Editor after 20261118000000_shop_orders_2.sql. Safe to run more than once.
-- Only adds three functions. Nothing is changed or deleted in the data.

select backup.take_snapshot('før migrering 20261119000000_shop_reservations.sql');

-- One reserved piece of an order line goes back to free stock: «Нужно заказать» +1 on the line.
create or replace function public.release_shop_reservation(p_order_item_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_movement uuid;
  v_quantity integer;
begin
  update public.shop_order_items i
  set missing = i.missing + 1
  from public.shop_orders o
  where i.id = p_order_item_id and i.missing < i.quantity and o.id = i.order_id and o.handed_over_on is null;
  if not found then return false; end if;

  select id, quantity into v_movement, v_quantity
  from public.shop_movements
  where order_item_id = p_order_item_id
  order by created_at desc
  limit 1;
  if v_movement is null then raise exception 'no reserved piece'; end if;
  if v_quantity > 1 then
    update public.shop_movements set quantity = quantity - 1 where id = v_movement;
  else
    delete from public.shop_movements where id = v_movement;
  end if;
  return true;
end;
$$;

-- One free piece is reserved for an order line that waits for it: «Нужно заказать» −1 on the line.
-- The app checks first that a free piece is there.
create or replace function public.reserve_shop_item(p_order_item_id uuid, p_on date)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_product uuid;
  v_price numeric;
begin
  update public.shop_order_items i
  set missing = i.missing - 1
  from public.shop_orders o
  where i.id = p_order_item_id and i.missing > 0 and o.id = i.order_id and o.handed_over_on is null
  returning i.product_id, i.price into v_product, v_price;
  if not found then return false; end if;

  insert into public.shop_movements (product_id, happened_on, kind, quantity, price, currency, order_item_id, created_at)
  values (v_product, p_on, 'sale', 1, v_price, 'PLN', p_order_item_id, clock_timestamp());
  return true;
end;
$$;

-- «Отдать ей»: one reserved piece moves from one order line to another (same product), in one go.
create or replace function public.move_shop_reservation(p_from_item_id uuid, p_to_item_id uuid, p_on date)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (select product_id from public.shop_order_items where id = p_from_item_id)
     is distinct from (select product_id from public.shop_order_items where id = p_to_item_id) then
    return false;
  end if;
  if not public.release_shop_reservation(p_from_item_id) then return false; end if;
  if not public.reserve_shop_item(p_to_item_id, p_on) then
    raise exception 'target does not wait';   -- rolls the release back
  end if;
  return true;
end;
$$;

revoke all on function public.release_shop_reservation(uuid) from public, anon;
revoke all on function public.reserve_shop_item(uuid, date) from public, anon;
revoke all on function public.move_shop_reservation(uuid, uuid, date) from public, anon;
grant execute on function public.release_shop_reservation(uuid) to authenticated;
grant execute on function public.reserve_shop_item(uuid, date) to authenticated;
grant execute on function public.move_shop_reservation(uuid, uuid, date) to authenticated;
