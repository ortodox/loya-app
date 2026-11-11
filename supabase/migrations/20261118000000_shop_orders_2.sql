-- MG10 + MG11 (approved 11.11.2026), part 2 of the orders in «Магазин»:
-- MG10 «Нужно заказать»: an order may ask for more than is in stock; the missing pieces are kept on the line
--   (shop_order_items.missing) and leave nothing in stock until a delivery is given to the order
--   («+» → «Для какого заказа?», public.give_shop_receipt_to_order). Stock never goes below zero.
-- MG11 payments: what the buyer has paid, in zł, several times if needed (shop_payments).
-- Run once in Supabase SQL Editor after 20261117000000_shop_returns.sql. Safe to run more than once.
-- Only adds a column, a table, its policies and a function, and replaces save_shop_order (same arguments;
-- it now also stores «missing»). Nothing is changed or deleted in the data.

select backup.take_snapshot('før migrering 20261118000000_shop_orders_2.sql');

alter table public.shop_order_items add column if not exists missing integer not null default 0;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'shop_order_items_missing_check') then
    alter table public.shop_order_items add constraint shop_order_items_missing_check check (missing >= 0 and missing <= quantity);
  end if;
end;
$$;

create table if not exists public.shop_payments (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null default auth.uid(),
  order_id uuid not null,
  amount numeric(10, 2) not null check (amount > 0),     -- zł
  paid_on date not null,
  created_at timestamptz not null default now(),
  foreign key (order_id, doctor_id) references public.shop_orders (id, doctor_id) on delete cascade
);
create index if not exists shop_payments_order_idx on public.shop_payments (order_id);

do $$
declare
  t text := 'shop_payments';
begin
  execute format('alter table public.%I enable row level security', t);
  execute format('revoke all on public.%I from anon', t);
  execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = t || ': owner') then
    execute format('create policy %I on public.%I for all to authenticated using (doctor_id = (select auth.uid())) with check (doctor_id = (select auth.uid()))', t || ': owner', t);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = t || ': require mfa') then
    execute format('create policy %I on public.%I as restrictive for all to authenticated using ((select auth.jwt() ->> ''aal'') = ''aal2'') with check ((select auth.jwt() ->> ''aal'') = ''aal2'')', t || ': require mfa', t);
  end if;
end;
$$;

create or replace function public.save_shop_order(
  p_order_id uuid,
  p_buyer_id uuid,
  p_buyer_name text,
  p_buyer_phone text,
  p_buyer_instagram text,
  p_ordered_on date,
  p_eur_rate numeric,
  p_rate_source text,
  p_items jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_buyer uuid := p_buyer_id;
  v_order uuid := p_order_id;
  v_date date := p_ordered_on;
  v_item uuid;
  item jsonb;
  i integer := 0;
begin
  if v_buyer is null then
    insert into public.shop_buyers (name, phone, instagram)
    values (p_buyer_name, coalesce(p_buyer_phone, ''), coalesce(p_buyer_instagram, ''))
    returning id into v_buyer;
  else
    update public.shop_buyers
    set name = p_buyer_name, phone = coalesce(p_buyer_phone, ''), instagram = coalesce(p_buyer_instagram, '')
    where id = v_buyer;
    if not found then raise exception 'buyer not found'; end if;
  end if;

  if v_order is null then
    insert into public.shop_orders (buyer_id, ordered_on, eur_rate, rate_source)
    values (v_buyer, p_ordered_on, p_eur_rate, p_rate_source)
    returning id into v_order;
  else
    update public.shop_orders
    set buyer_id = v_buyer, eur_rate = p_eur_rate, rate_source = p_rate_source
    where id = v_order and handed_over_on is null;
    if not found then raise exception 'order not editable'; end if;
    delete from public.shop_order_items where order_id = v_order;   -- their sales go with them
  end if;

  for item in select value from jsonb_array_elements(p_items) loop
    i := i + 1;
    -- MG10: «missing» pieces are not in stock yet («Нужно заказать») – only the rest leaves the stock now.
    insert into public.shop_order_items (order_id, product_id, quantity, price, sort_order, missing)
    values (v_order, (item ->> 'product_id')::uuid, (item ->> 'quantity')::integer, (item ->> 'price')::numeric, i,
            coalesce((item ->> 'missing')::integer, 0))
    returning id into v_item;
    if (item ->> 'quantity')::integer - coalesce((item ->> 'missing')::integer, 0) > 0 then
      insert into public.shop_movements (product_id, happened_on, kind, quantity, price, currency, order_item_id)
      values ((item ->> 'product_id')::uuid, v_date, 'sale',
              (item ->> 'quantity')::integer - coalesce((item ->> 'missing')::integer, 0), (item ->> 'price')::numeric, 'PLN', v_item);
    end if;
  end loop;

  return v_order;
end;
$$;

revoke all on function public.save_shop_order(uuid, uuid, text, text, text, date, numeric, text, jsonb) from public, anon;
grant execute on function public.save_shop_order(uuid, uuid, text, text, text, date, numeric, text, jsonb) to authenticated;


-- MG10: one delivered piece goes straight to an order that waits for it: a delivery (+1) and the order's
-- sale (+1) in one go, and one piece less «Нужно заказать». Runs as the signed-in doctor (RLS applies).
create or replace function public.give_shop_receipt_to_order(p_order_item_id uuid, p_on date)
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

  -- The piece comes in and goes out the same day, in that order (clock_timestamp keeps them apart).
  insert into public.shop_movements (product_id, happened_on, kind, quantity, created_at)
  values (v_product, p_on, 'receipt', 1, clock_timestamp());
  insert into public.shop_movements (product_id, happened_on, kind, quantity, price, currency, order_item_id, created_at)
  values (v_product, p_on, 'sale', 1, v_price, 'PLN', p_order_item_id, clock_timestamp());
  return true;
end;
$$;

revoke all on function public.give_shop_receipt_to_order(uuid, date) from public, anon;
grant execute on function public.give_shop_receipt_to_order(uuid, date) to authenticated;

-- Backup: snapshots also cover the payments ---------------------------------------------------------
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

  insert into backup.snapshots (taken_at, reason, table_name, row_data)
  select snapshot_time, take_snapshot.reason, 'shop_products', to_jsonb(r) from public.shop_products r;
  get diagnostics n = row_count; copied := copied + n;

  insert into backup.snapshots (taken_at, reason, table_name, row_data)
  select snapshot_time, take_snapshot.reason, 'shop_movements', to_jsonb(r) from public.shop_movements r;
  get diagnostics n = row_count; copied := copied + n;

  insert into backup.snapshots (taken_at, reason, table_name, row_data)
  select snapshot_time, take_snapshot.reason, 'shop_buyers', to_jsonb(r) from public.shop_buyers r;
  get diagnostics n = row_count; copied := copied + n;

  insert into backup.snapshots (taken_at, reason, table_name, row_data)
  select snapshot_time, take_snapshot.reason, 'shop_orders', to_jsonb(r) from public.shop_orders r;
  get diagnostics n = row_count; copied := copied + n;

  insert into backup.snapshots (taken_at, reason, table_name, row_data)
  select snapshot_time, take_snapshot.reason, 'shop_order_items', to_jsonb(r) from public.shop_order_items r;
  get diagnostics n = row_count; copied := copied + n;

  insert into backup.snapshots (taken_at, reason, table_name, row_data)
  select snapshot_time, take_snapshot.reason, 'shop_settings', to_jsonb(r) from public.shop_settings r;
  get diagnostics n = row_count; copied := copied + n;

  insert into backup.snapshots (taken_at, reason, table_name, row_data)
  select snapshot_time, take_snapshot.reason, 'shop_payments', to_jsonb(r) from public.shop_payments r;
  get diagnostics n = row_count; copied := copied + n;

  return copied;
end;
$$;

revoke all on function backup.take_snapshot(text) from public, anon, authenticated;
