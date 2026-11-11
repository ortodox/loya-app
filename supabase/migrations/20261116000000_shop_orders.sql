-- MG9 + MG12 (approved 11.11.2026): orders in «Магазин» – several products for one buyer, all in zł,
-- price per line (Instytutum by the NBP selling rate or Loya's own rate, rounded to whole zł), handed over
-- all at once («Выдан ✓»). Buyers are kept apart from clients (own table, never in «Клиенты»).
-- Run once in Supabase SQL Editor after 20261115000000_shop_xmas_sets.sql. Safe to run more than once.
-- Only adds four tables, one column (shop_movements.order_item_id), policies, one function and the tables
-- to the snapshot. Nothing is changed or deleted.

select backup.take_snapshot('før migrering 20261116000000_shop_orders.sql');

-- Buyers of cosmetics – not clients: a name and, if Loya wants, a phone and an Instagram handle.
create table if not exists public.shop_buyers (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null default auth.uid(),
  name text not null check (length(trim(name)) > 0),
  phone text not null default '',
  instagram text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, doctor_id)
);

create table if not exists public.shop_orders (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null default auth.uid(),
  buyer_id uuid not null,
  ordered_on date not null,
  eur_rate numeric(8, 4) check (eur_rate is null or eur_rate > 0),   -- the € rate used for this order
  rate_source text check (rate_source is null or rate_source in ('nbp', 'own')),
  handed_over_on date,                                              -- «Выдан ✓»; null = waiting
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, doctor_id),
  foreign key (buyer_id, doctor_id) references public.shop_buyers (id, doctor_id) on delete cascade
);

create table if not exists public.shop_order_items (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null default auth.uid(),
  order_id uuid not null,
  product_id uuid not null,
  quantity integer not null check (quantity > 0 and quantity <= 1000),
  price numeric(10, 2) not null check (price >= 0),                 -- per piece, in zł
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (id, doctor_id),
  foreign key (order_id, doctor_id) references public.shop_orders (id, doctor_id) on delete cascade,
  foreign key (product_id, doctor_id) references public.shop_products (id, doctor_id) on delete cascade
);

-- One row per doctor: Loya's own € rate (null = NBP) and the last NBP rate fetched (used when NBP is down).
create table if not exists public.shop_settings (
  doctor_id uuid primary key default auth.uid(),
  own_eur_rate numeric(8, 4) check (own_eur_rate is null or own_eur_rate > 0),
  nbp_eur_rate numeric(8, 4) check (nbp_eur_rate is null or nbp_eur_rate > 0),
  nbp_rate_date date,
  updated_at timestamptz not null default now()
);

-- A sale made by an order: removed together with the order line (editing or cancelling the order).
alter table public.shop_movements add column if not exists order_item_id uuid;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'shop_movements_order_item_fkey') then
    alter table public.shop_movements add constraint shop_movements_order_item_fkey
      foreign key (order_item_id, doctor_id) references public.shop_order_items (id, doctor_id) on delete cascade;
  end if;
end;
$$;

create index if not exists shop_orders_buyer_idx on public.shop_orders (buyer_id);
create index if not exists shop_order_items_order_idx on public.shop_order_items (order_id);
create index if not exists shop_movements_order_item_idx on public.shop_movements (order_item_id);

-- Row Level Security: owner only, and only after TOTP (aal2) -----------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['shop_buyers', 'shop_orders', 'shop_order_items', 'shop_settings'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = t || ': owner') then
      execute format('create policy %I on public.%I for all to authenticated using (doctor_id = (select auth.uid())) with check (doctor_id = (select auth.uid()))', t || ': owner', t);
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = t || ': require mfa') then
      execute format('create policy %I on public.%I as restrictive for all to authenticated using ((select auth.jwt() ->> ''aal'') = ''aal2'') with check ((select auth.jwt() ->> ''aal'') = ''aal2'')', t || ': require mfa', t);
    end if;
  end loop;
end;
$$;

create or replace trigger shop_buyers_set_updated_at
  before update on public.shop_buyers for each row execute function public.set_updated_at();
create or replace trigger shop_orders_set_updated_at
  before update on public.shop_orders for each row execute function public.set_updated_at();

-- Save an order in one go (buyer, order, lines and their sales), so a failure leaves nothing half saved.
-- Runs as the signed-in doctor (security invoker): RLS applies as for every other query.
-- p_items: [{"product_id": "…", "quantity": 2, "price": 230.00}, …]. An order already handed over is not changed.
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
    where id = v_order and handed_over_on is null
    returning ordered_on into v_date;
    if not found then raise exception 'order not editable'; end if;
    delete from public.shop_order_items where order_id = v_order;   -- their sales go with them
  end if;

  for item in select value from jsonb_array_elements(p_items) loop
    i := i + 1;
    insert into public.shop_order_items (order_id, product_id, quantity, price, sort_order)
    values (v_order, (item ->> 'product_id')::uuid, (item ->> 'quantity')::integer, (item ->> 'price')::numeric, i)
    returning id into v_item;
    insert into public.shop_movements (product_id, happened_on, kind, quantity, price, currency, order_item_id)
    values ((item ->> 'product_id')::uuid, v_date, 'sale', (item ->> 'quantity')::integer, (item ->> 'price')::numeric, 'PLN', v_item);
  end loop;

  return v_order;
end;
$$;

revoke all on function public.save_shop_order(uuid, uuid, text, text, text, date, numeric, text, jsonb) from public, anon;
grant execute on function public.save_shop_order(uuid, uuid, text, text, text, date, numeric, text, jsonb) to authenticated;

-- Backup: snapshots also cover orders, buyers and the shop settings ------------------------------
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

  return copied;
end;
$$;

revoke all on function backup.take_snapshot(text) from public, anon, authenticated;
