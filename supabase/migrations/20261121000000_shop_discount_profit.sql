-- MG20–MG22 (approved 25.11.2026): a discount on the whole order («−10 %» … «−40 %»), and what to put aside
-- for buying again versus Loya's own profit – per order and for the month in «Продажи».
-- The discount is kept as a percent on the order; the total after the discount is worked out in the app.
-- Every order line keeps the purchase price of the day it was saved (like sales do, MG19), so the profit
-- stays right when the purchase price changes later. Lines saved before have none – «не посчитано».
-- Run once in Supabase SQL Editor after 20261120000000_shop_purchase_price.sql. Safe to run more than once.
-- Only adds columns, one function and one trigger. Nothing is changed or deleted.

select backup.take_snapshot('før migrering 20261121000000_shop_discount_profit.sql');

alter table public.shop_orders add column if not exists discount_percent smallint;
alter table public.shop_orders drop constraint if exists shop_orders_discount_percent_check;
alter table public.shop_orders add constraint shop_orders_discount_percent_check check (discount_percent is null or discount_percent between 1 and 99);

alter table public.shop_order_items add column if not exists purchase_price numeric(10, 2);
alter table public.shop_order_items add column if not exists purchase_currency text;
alter table public.shop_order_items drop constraint if exists shop_order_items_purchase_currency_check;
alter table public.shop_order_items add constraint shop_order_items_purchase_currency_check check (purchase_currency is null or purchase_currency in ('PLN', 'EUR'));

-- Security invoker: RLS still applies, the product is the doctor's own.
create or replace function private.shop_order_item_purchase_price()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.purchase_price is null then
    select p.purchase_price, case when p.purchase_price is null then null else p.currency end
      into new.purchase_price, new.purchase_currency
      from public.shop_products p
     where p.id = new.product_id;
  end if;
  return new;
end;
$$;

drop trigger if exists shop_order_item_purchase_price on public.shop_order_items;
create trigger shop_order_item_purchase_price
  before insert on public.shop_order_items
  for each row execute function private.shop_order_item_purchase_price();
