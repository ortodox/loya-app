-- MG6/MG7 (10.11.2026): «−» in «Магазин» asks «Товар продан?» – «Нет, исправление» is a correction
-- that lowers the stock but is not a sale. Widens the allowed kinds of shop_movements; no data changes.
select backup.take_snapshot('før migrering 20261114000000_shop_correction.sql');

alter table public.shop_movements drop constraint if exists shop_movements_kind_check;
alter table public.shop_movements add constraint shop_movements_kind_check check (kind in ('sale', 'receipt', 'correction'));
