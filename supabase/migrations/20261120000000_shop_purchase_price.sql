-- MG19 (approved 24.11.2026): «Закупочная цена» – what a product costs Loya, in the product's currency
-- (Medik8 zł, Instytutum €). Empty to begin with; she fills it in later (or from a file). Every new sale
-- keeps the purchase price of that day, so «Прибыль» can later be counted right even if the price changes.
-- Run once in Supabase SQL Editor after 20261119000000_shop_reservations.sql. Safe to run more than once.
-- Only adds columns, one function and one trigger. Nothing is changed or deleted.

select backup.take_snapshot('før migrering 20261120000000_shop_purchase_price.sql');

alter table public.shop_products add column if not exists purchase_price numeric(10, 2);
alter table public.shop_products drop constraint if exists shop_products_purchase_price_check;
alter table public.shop_products add constraint shop_products_purchase_price_check check (purchase_price is null or purchase_price >= 0);

-- The purchase price at the time of the sale, in the product's currency (an order sale is in zł, the
-- purchase price of Instytutum stays in €). Null = not known when it was sold.
alter table public.shop_movements add column if not exists purchase_price numeric(10, 2);
alter table public.shop_movements add column if not exists purchase_currency text;
alter table public.shop_movements drop constraint if exists shop_movements_purchase_currency_check;
alter table public.shop_movements add constraint shop_movements_purchase_currency_check check (purchase_currency is null or purchase_currency in ('PLN', 'EUR'));

-- Every sale – a tap in «Склад», «Кому?», orders and deliveries given to an order – gets it here, so no
-- path can forget it. Security invoker: RLS still applies, the product is the doctor's own.
create or replace function private.shop_sale_purchase_price()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.kind = 'sale' and new.purchase_price is null then
    select p.purchase_price, case when p.purchase_price is null then null else p.currency end
      into new.purchase_price, new.purchase_currency
      from public.shop_products p
     where p.id = new.product_id;
  end if;
  return new;
end;
$$;

drop trigger if exists shop_sale_purchase_price on public.shop_movements;
create trigger shop_sale_purchase_price
  before insert on public.shop_movements
  for each row execute function private.shop_sale_purchase_price();
