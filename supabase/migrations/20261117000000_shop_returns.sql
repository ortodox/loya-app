-- MG13 (approved 11.11.2026): «Исправить» in «Продажи» → «Да» gives a sale back to stock. The sale is kept
-- and marked as returned, so «История» shows «Продажа −1» and later «Возврат +1»; «Продажи» leaves it out.
-- Run once in Supabase SQL Editor after 20261116000000_shop_orders.sql. Safe to run more than once.
-- Only adds two columns. Nothing is changed or deleted.

select backup.take_snapshot('før migrering 20261117000000_shop_returns.sql');

alter table public.shop_movements add column if not exists returned_on date;
alter table public.shop_movements add column if not exists returned_at timestamptz;
