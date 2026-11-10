-- MG1–MG4 «Магазин» (approved 10.11.2026): cosmetics Loya sells (Medik8, Instytutum) – catalogue with
-- search, brand filter and ⭐, stock with «−» (sale) and «+» (delivery), history and sales per month.
-- Sales are not linked to clients. Prices can be changed in the app; RRP, wholesale and margin come
-- from the price lists (metadata, not shown). No client data in these tables.
-- Run once in Supabase SQL Editor after 20261112000000_stock_history_delete.sql. Safe to run more than once.
-- Only adds two tables, their policies, a seed function and the tables to the snapshot; seeds the price
-- lists for every doctor who has a catalogue (existing products are never changed). Nothing is deleted.

select backup.take_snapshot('før migrering 20261113000000_shop.sql');

create table if not exists public.shop_products (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null default auth.uid(),
  code text,                                            -- stable key of a seeded product («M8-001», «IN-001»)
  brand text not null,
  category text not null default '',
  name text not null,
  size text not null default '',
  currency text not null default 'PLN' check (currency in ('PLN', 'EUR')),
  price numeric(10, 2) not null default 0 check (price >= 0),   -- selling price (RRP), editable
  wholesale numeric(10, 2),                             -- metadata from the price lists, not shown
  price_per_4 numeric(10, 2),
  average_cost numeric(10, 2),
  gross_profit numeric(10, 2),
  gross_margin numeric(5, 1),
  favorite boolean not null default false,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, doctor_id),
  unique (doctor_id, code)
);

-- «−» (sale) and «+» (delivery): one row per tap; a sale keeps the price it was sold for.
create table if not exists public.shop_movements (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null default auth.uid(),
  product_id uuid not null,
  happened_on date not null,
  kind text not null check (kind in ('sale', 'receipt')),
  quantity integer not null default 1 check (quantity > 0 and quantity <= 1000),
  price numeric(10, 2),                                 -- sales: the price at the time
  currency text check (currency is null or currency in ('PLN', 'EUR')),
  created_at timestamptz not null default now(),
  foreign key (product_id, doctor_id) references public.shop_products (id, doctor_id) on delete cascade
);

create index if not exists shop_movements_product_idx on public.shop_movements (product_id, happened_on);
create index if not exists shop_movements_month_idx on public.shop_movements (doctor_id, happened_on);

-- Row Level Security: owner only, and only after TOTP (aal2) -----------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['shop_products', 'shop_movements'] loop
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

create or replace trigger shop_products_set_updated_at
  before update on public.shop_products for each row execute function public.set_updated_at();

-- Seed: the price lists (Medik8 21.09.2026 in PLN, Instytutum 2026 in EUR). Idempotent – a product
-- already there (same code) is left as it is, so prices Loya has changed stay.
create schema if not exists private;

create or replace function private.seed_shop(p_doctor uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  added integer;
begin
  insert into public.shop_products (doctor_id, code, brand, category, name, size, currency, price, wholesale, price_per_4, average_cost, gross_profit, gross_margin, sort_order)
  select p_doctor, v.code, v.brand, v.category, v.name, v.size, v.currency, v.price, v.wholesale, v.price_per_4, v.average_cost, v.gross_profit, v.gross_margin, v.sort_order
  from (values
    ('M8-001', 'Medik8', 'Очищение', 'Daily Refresh Balancing Toner', '150 ml', 'PLN', 133.49, 83.89, null, null, 49.60, 37.2, 10),
    ('M8-002', 'Medik8', 'Очищение', 'Surface Radiance Cleanse', '150 ml', 'PLN', 136.69, 87.04, null, null, 49.65, 36.3, 20),
    ('M8-003', 'Medik8', 'Очищение', 'Gentle Cleanse', '150 ml', 'PLN', 136.69, 87.04, null, null, 49.65, 36.3, 30),
    ('M8-004', 'Medik8', 'Очищение', 'Clarifying Foam', '150 ml', 'PLN', 136.69, 87.76, null, null, 48.93, 35.8, 40),
    ('M8-005', 'Medik8', 'Очищение', 'Calmwise Soothing Cleanser', '150 ml', 'PLN', 136.69, 87.76, null, null, 48.93, 35.8, 50),
    ('M8-006', 'Medik8', 'Очищение', 'Pore Cleanse Gel Intense', '150 ml', 'PLN', 136.69, 87.76, null, null, 48.93, 35.8, 60),
    ('M8-007', 'Medik8', 'Очищение', 'Micellar Mousse', '150 ml', 'PLN', 142.50, 92.01, null, null, 50.49, 35.4, 70),
    ('M8-008', 'Medik8', 'Очищение', 'Lipid-Balance Cleansing Oil', '140 ml', 'PLN', 178.00, 111.57, null, null, 66.43, 37.3, 80),
    ('M8-009', 'Medik8', 'Очищение', 'Total Moisture Daily Cleansing Gel', '145 ml', 'PLN', 165.30, 103.61, null, null, 61.69, 37.3, 90),
    ('M8-010', 'Medik8', 'Витамин C', 'C-Tetra Eye', '7 ml', 'PLN', 136.46, 87.14, null, null, 49.32, 36.1, 100),
    ('M8-011', 'Medik8', 'Витамин C', 'C-Tetra', '30 ml', 'PLN', 230.41, 147.47, null, null, 82.94, 36.0, 110),
    ('M8-012', 'Medik8', 'Витамин C', 'C-Tetra Cream', '50 ml', 'PLN', 284.72, 216.38, null, null, 68.34, 24.0, 120),
    ('M8-013', 'Medik8', 'Витамин C', 'Daily Radiance Vitamin C SPF 30', '50 ml', 'PLN', 336.30, 219.16, null, null, 117.14, 34.8, 130),
    ('M8-014', 'Medik8', 'Витамин C', 'Super C30 Ferulic', '30 ml', 'PLN', 393.47, 264.74, null, null, 128.73, 32.7, 140),
    ('M8-015', 'Medik8', 'Витамин C', 'C-Tetra Luxe', '30 ml', 'PLN', 336.30, 226.26, null, null, 110.04, 32.7, 150),
    ('M8-016', 'Medik8', 'Витамин C', 'C-Tetra Advanced', '30 ml', 'PLN', 410.00, 276.39, null, null, 133.61, 32.6, 160),
    ('M8-017', 'Medik8', 'Витамин A', 'Intelligent Retinol Eye TR', '7 ml', 'PLN', 136.46, 87.14, null, null, 49.32, 36.1, 170),
    ('M8-018', 'Medik8', 'Витамин A', 'Intelligent Retinol Smoothing Night Cream', '50 ml', 'PLN', 336.30, 215.56, null, null, 120.74, 35.9, 180),
    ('M8-019', 'Medik8', 'Витамин A', 'Crystal Retinal 1', '30 ml', 'PLN', 260.00, 162.07, null, null, 97.93, 37.7, 190),
    ('M8-020', 'Medik8', 'Витамин A', 'Crystal Retinal 3', '30 ml', 'PLN', 279.30, 179.30, null, null, 100.00, 35.8, 200),
    ('M8-021', 'Medik8', 'Витамин A', 'Crystal Retinal 6', '30 ml', 'PLN', 410.00, 261.93, null, null, 148.07, 36.1, 210),
    ('M8-022', 'Medik8', 'Витамин A', 'Crystal Retinal 10', '30 ml', 'PLN', 530.00, 338.62, null, null, 191.38, 36.1, 220),
    ('M8-023', 'Medik8', 'Витамин A', 'Crystal Retinal 20', '30 ml', 'PLN', 582.00, 418.20, null, null, 163.80, 28.1, 230),
    ('M8-024', 'Medik8', 'Витамин A', 'Crystal Retinal 24', '30 ml', 'PLN', 641.00, 439.92, null, null, 201.08, 31.4, 240),
    ('M8-025', 'Medik8', 'Витамин A', 'Crystal Retinal Ceramide Eye 3', '15 ml', 'PLN', 240.00, 159.18, null, null, 80.82, 33.7, 250),
    ('M8-026', 'Medik8', 'Витамин A', 'Crystal Retinal Ceramide Eye 6', '15 ml', 'PLN', 325.00, 214.17, null, null, 110.83, 34.1, 260),
    ('M8-027', 'Medik8', 'Витамин A', 'Crystal Retinal Ceramide Eye 10', '15 ml', 'PLN', 420.00, 279.28, null, null, 140.72, 33.5, 270),
    ('M8-028', 'Medik8', 'Дневные кремы', 'Advanced Day Eye Protect SPF 30', '15 ml', 'PLN', 228.00, 140.72, null, null, 87.28, 38.3, 280),
    ('M8-029', 'Medik8', 'Дневные кремы', 'Physical Sunscreen SPF 50+', '60 ml', 'PLN', 222.30, 159.42, null, null, 62.88, 28.3, 290),
    ('M8-030', 'Medik8', 'Дневные кремы', 'Balance Moisturiser', '50 ml', 'PLN', 296.06, 190.05, null, null, 106.01, 35.8, 300),
    ('M8-031', 'Medik8', 'Дневные кремы', 'Calmwise Colour Correct', '50 ml', 'PLN', 279.30, 186.46, null, null, 92.84, 33.2, 310),
    ('M8-032', 'Medik8', 'Дневные кремы', 'Advanced Day Total Protect SPF 30', '50 ml', 'PLN', 324.90, 210.89, null, null, 114.01, 35.1, 320),
    ('M8-033', 'Medik8', 'Дневные кремы', 'Advanced Day Ultimate Protect SPF 50+', '50 ml', 'PLN', 336.30, 246.50, null, null, 89.80, 26.7, 330),
    ('M8-034', 'Medik8', 'Дневные кремы', 'Total Moisture Daily Facial Cream', '50 ml', 'PLN', 290.00, 191.02, null, null, 98.98, 34.1, 340),
    ('M8-035', 'Medik8', 'Дневные кремы', 'Total Moisture Daily Facial Cream Refill', '50 ml', 'PLN', 260.00, 180.88, null, null, 79.12, 30.4, 350),
    ('M8-036', 'Medik8', 'Дневные кремы', 'Advanced Pro Collagen+ Peptide Cream', '50 ml', 'PLN', 460.00, 324.15, null, null, 135.85, 29.5, 360),
    ('M8-037', 'Medik8', 'Дневные кремы', 'Advanced Pro Collagen+ Peptide Cream Refill', '50 ml', 'PLN', 420.00, 296.65, null, null, 123.35, 29.4, 370),
    ('M8-038', 'Medik8', 'Ночные кремы', 'Advanced Night Eye', '15 ml', 'PLN', 239.40, 148.84, null, null, 90.56, 37.8, 380),
    ('M8-039', 'Medik8', 'Ночные кремы', 'Advanced Night Restore', '50 ml', 'PLN', 360.00, 240.22, null, null, 119.78, 33.3, 390),
    ('M8-040', 'Medik8', 'Бустеры', 'Hydr8 B5', '30 ml', 'PLN', 256.50, 163.91, null, null, 92.59, 36.1, 400),
    ('M8-041', 'Medik8', 'Бустеры', 'Hydr8 B5 Intense', '30 ml', 'PLN', 336.30, 217.09, null, null, 119.21, 35.4, 410),
    ('M8-042', 'Medik8', 'Бустеры', 'Exosome Serum', '30 ml', 'PLN', 450.00, 303.88, null, null, 146.12, 32.5, 420),
    ('M8-043', 'Medik8', 'Бустеры', 'Calmwise Serum', '15 ml', 'PLN', 221.62, 129.97, null, null, 91.65, 41.4, 430),
    ('M8-044', 'Medik8', 'Уход за телом', 'Smooth Body Exfoliating Kit', 'набор', 'PLN', 296.40, 196.31, null, null, 100.09, 33.8, 440),
    ('M8-045', 'Medik8', 'С кислотами', 'Press & Glow', '200 ml', 'PLN', 195.00, 137.47, null, null, 57.53, 29.5, 450),
    ('M8-046', 'Medik8', 'С кислотами', 'Press & Glow Refill', '200 ml', 'PLN', 167.00, 127.34, null, null, 39.66, 23.7, 460),
    ('M8-047', 'Medik8', 'С кислотами', 'Press & Clear', '150 ml', 'PLN', 210.00, 144.71, null, null, 65.29, 31.1, 470),
    ('M8-048', 'Medik8', 'С кислотами', 'Press & Clear Refill', '150 ml', 'PLN', 176.23, 126.70, null, null, 49.53, 28.1, 480),
    ('M8-049', 'Medik8', 'С кислотами', 'Blemish Control Pads', '60 шт', 'PLN', 171.00, 107.57, null, null, 63.43, 37.1, 490),
    ('M8-050', 'Medik8', 'С кислотами', 'Sleep Glycolic', '30 ml', 'PLN', 222.30, 159.49, null, null, 62.81, 28.3, 500),
    ('M8-051', 'Medik8', 'С пептидами', 'Eyelift Peptides', '15 ml', 'PLN', 257.36, 163.53, null, null, 93.83, 36.5, 510),
    ('M8-052', 'Medik8', 'С пептидами', 'Liquid Peptides', '31 ml', 'PLN', 325.95, 212.43, null, null, 113.52, 34.8, 520),
    ('M8-053', 'Medik8', 'С пептидами', 'Liquid Peptides Advanced MP', '30 ml', 'PLN', 460.00, 312.57, null, null, 147.43, 32.0, 530),
    ('M8-054', 'Medik8', 'С пептидами', 'Niacinamide Peptides', '30 ml', 'PLN', 279.30, 179.30, null, null, 100.00, 35.8, 540),
    ('M8-055', 'Medik8', 'С пептидами', 'Bakuchiol Peptides', '30 ml', 'PLN', 312.82, 204.59, null, null, 108.23, 34.6, 550),
    ('M8-056', 'Medik8', 'С пептидами', 'Oxy-R Peptides', '2 × 10 ml', 'PLN', 369.36, 254.36, null, null, 115.00, 31.1, 560),
    ('M8-057', 'Medik8', 'Другое', 'Blemish SOS', '15 ml', 'PLN', 142.44, 90.97, null, null, 51.47, 36.1, 570),
    ('M8-058', 'Medik8', 'Другое', 'Ultimate Recovery', '30 ml', 'PLN', 222.30, 141.89, null, null, 80.41, 36.2, 580),
    ('M8-059', 'Medik8', 'Другое', 'H.E.O Mask', '2 × 50 ml', 'PLN', 341.15, 220.32, null, null, 120.83, 35.4, 590),
    ('M8-060', 'Medik8', 'Другое', 'Ultimate Recovery Bio Cellulose Mask', '6 масок', 'PLN', 401.00, 276.31, null, null, 124.69, 31.1, 600),
    ('M8-061', 'Medik8', 'r-Retinoate', 'r-Retinoate Day & Night Eye Serum', '15 ml', 'PLN', 564.30, 391.11, null, null, 173.19, 30.7, 610),
    ('M8-062', 'Medik8', 'r-Retinoate', 'r-Retinoate', '50 ml', 'PLN', 849.30, 630.93, null, null, 218.37, 25.7, 620),
    ('M8-063', 'Medik8', 'r-Retinoate', 'r-Retinoate Intense', '50 ml', 'PLN', 1305.30, 860.39, null, null, 444.91, 34.1, 630),
    ('M8-064', 'Medik8', 'Наборы', 'Post Treatment Kit', 'набор', 'PLN', 182.40, 131.62, null, null, 50.78, 27.8, 640),
    ('M8-065', 'Medik8', 'Пробники (Try Me)', 'Try Me Gentle Cleanse', '40 ml', 'PLN', 57.00, 38.80, null, null, 18.20, 31.9, 650),
    ('M8-066', 'Medik8', 'Пробники (Try Me)', 'Try Me Clarifying Foam', '40 ml', 'PLN', 57.00, 38.80, null, null, 18.20, 31.9, 660),
    ('M8-067', 'Medik8', 'Пробники (Try Me)', 'Try Me Calmwise Soothing', '40 ml', 'PLN', 57.00, 38.80, null, null, 18.20, 31.9, 670),
    ('M8-068', 'Medik8', 'Пробники (Try Me)', 'Try Me Surface Radiance Cleanse', '40 ml', 'PLN', 57.00, 49.87, null, null, 7.13, 12.5, 680),
    ('M8-069', 'Medik8', 'Пробники (Try Me)', 'Try Me C-Tetra', '8 ml', 'PLN', 80.56, 57.16, null, null, 23.40, 29.0, 690),
    ('M8-070', 'Medik8', 'Пробники (Try Me)', 'Try Me C-Tetra Cream', '12,5 ml', 'PLN', 103.06, 70.18, null, null, 32.88, 31.9, 700),
    ('M8-071', 'Medik8', 'Пробники (Try Me)', 'Try Me C-Tetra Luxe', '8 ml', 'PLN', 114.00, 86.59, null, null, 27.41, 24.0, 710),
    ('M8-072', 'Medik8', 'Пробники (Try Me)', 'Try Me Daily Radiance Vitamin C SPF 30', '12,5 ml', 'PLN', 108.30, 76.75, null, null, 31.55, 29.1, 720),
    ('M8-073', 'Medik8', 'Пробники (Try Me)', 'Try Me Calmwise Colour Correct', '15 ml', 'PLN', 96.90, 70.33, null, null, 26.57, 27.4, 730),
    ('M8-074', 'Medik8', 'Пробники (Try Me)', 'Try Me Total Daily Moisture', '12,5 ml', 'PLN', 96.00, 69.46, null, null, 26.54, 27.6, 740),
    ('M8-075', 'Medik8', 'Пробники (Try Me)', 'Try Me Advanced Pro Collagen+ Peptide Cream', '12,5 ml', 'PLN', 156.00, 111.43, null, null, 44.57, 28.6, 750),
    ('M8-076', 'Medik8', 'Пробники (Try Me)', 'Try Me Advanced Night Restore', '12,5 ml', 'PLN', 111.00, 79.59, null, null, 31.41, 28.3, 760),
    ('M8-077', 'Medik8', 'Пробники (Try Me)', 'Try Me Hydr8 B5', '8 ml', 'PLN', 91.20, 64.94, null, null, 26.26, 28.8, 770),
    ('M8-078', 'Medik8', 'Пробники (Try Me)', 'Try Me Hydr8 B5 Intense', '8 ml', 'PLN', 114.00, 80.86, null, null, 33.14, 29.1, 780),
    ('M8-079', 'Medik8', 'Пробники (Try Me)', 'Try Me Liquid Peptides', '8 ml', 'PLN', 108.53, 77.99, null, null, 30.54, 28.1, 790),
    ('M8-080', 'Medik8', 'Пробники (Try Me)', 'Try Me Press & Clear', '30 ml', 'PLN', 72.00, 50.65, null, null, 21.35, 29.7, 800),
    ('M8-081', 'Medik8', 'Пробники (Try Me)', 'Try Me Press & Glow', '30 ml', 'PLN', 55.00, 39.06, null, null, 15.94, 29.0, 810),
    ('IN-001', 'Instytutum', 'Очищение', 'Adaptogel Cleanser', '100 ml', 'EUR', 45.00, 27.00, 81.00, 20.25, 24.75, 55.0, 820),
    ('IN-002', 'Instytutum', 'Очищение', 'Renewal Melting Cleanser', '120 ml', 'EUR', 45.00, 27.00, 81.00, 20.25, 24.75, 55.0, 830),
    ('IN-003', 'Instytutum', 'Пилинг', 'Triple Action Resurfacing Peel', '60 ml', 'EUR', 85.00, 51.00, 153.00, 38.25, 46.75, 55.0, 840),
    ('IN-004', 'Instytutum', 'Сыворотки', 'Brightening Vitamin C Serum', '30 ml', 'EUR', 125.00, 75.00, 225.00, 56.25, 68.75, 55.0, 850),
    ('IN-005', 'Instytutum', 'Сыворотки', 'X-Strength Retinol Serum', '30 ml', 'EUR', 125.00, 75.00, 225.00, 56.25, 68.75, 55.0, 860),
    ('IN-006', 'Instytutum', 'Сыворотки', 'Powerful RetinOil', '30 ml', 'EUR', 95.00, 57.00, 171.00, 42.75, 52.25, 55.0, 870),
    ('IN-007', 'Instytutum', 'Кремы', 'HydraFusion Hydrating Gel Cream', '50 ml', 'EUR', 85.00, 51.00, 153.00, 38.25, 46.75, 55.0, 880),
    ('IN-008', 'Instytutum', 'Кремы', 'SuperBiotic Regenerating Cream', '50 ml', 'EUR', 85.00, 51.00, 153.00, 38.25, 46.75, 55.0, 890),
    ('IN-009', 'Instytutum', 'Кремы', 'Xceptional Flawless Cream', '50 ml', 'EUR', 120.00, 72.00, 216.00, 54.00, 66.00, 55.0, 900),
    ('IN-010', 'Instytutum', 'Рефилы', 'HydraFusion Refill Pod', '50 ml', 'EUR', 70.00, 42.00, 126.00, 31.50, 38.50, 55.0, 910),
    ('IN-011', 'Instytutum', 'Рефилы', 'SuperBiotic Refill Pod', '50 ml', 'EUR', 70.00, 42.00, 126.00, 31.50, 38.50, 55.0, 920),
    ('IN-012', 'Instytutum', 'Рефилы', 'C-Illuminating Refill Pod', '50 ml', 'EUR', 70.00, 42.00, 126.00, 31.50, 38.50, 55.0, 930),
    ('IN-013', 'Instytutum', 'SPF', 'Sunscription Dark Spot Defence SPF50', '50 ml', 'EUR', 59.00, 35.00, 105.00, 26.25, 32.75, 55.5, 940),
    ('IN-014', 'Instytutum', 'Мини-форматы', 'Transforming Melting Cleanser', '20 ml', 'EUR', 15.00, 9.00, 27.00, 6.75, 8.25, 55.0, 950),
    ('IN-015', 'Instytutum', 'Мини-форматы', 'Advanced Retinol Toner', '50 ml', 'EUR', 30.00, 18.00, 54.00, 13.50, 16.50, 55.0, 960),
    ('IN-016', 'Instytutum', 'Мини-форматы', 'Triple Action Resurfacing Peel Mini', '20 ml', 'EUR', 38.00, 23.00, 69.00, 17.25, 20.75, 54.6, 970),
    ('IN-017', 'Instytutum', 'Мини-форматы', 'Retinol Serum', '10 ml', 'EUR', 55.00, 33.00, 99.00, 24.75, 30.25, 55.0, 980),
    ('IN-018', 'Instytutum', 'Мини-форматы', 'HydraFusion Mini', '15 ml', 'EUR', 40.00, 24.00, 72.00, 18.00, 22.00, 55.0, 990),
    ('IN-019', 'Instytutum', 'Мини-форматы', 'SuperBiotic Mini', '15 ml', 'EUR', 40.00, 24.00, 72.00, 18.00, 22.00, 55.0, 1000),
    ('IN-020', 'Instytutum', 'Мини-форматы', 'C-Illuminating Mini', '15 ml', 'EUR', 40.00, 24.00, 72.00, 18.00, 22.00, 55.0, 1010),
    ('IN-021', 'Instytutum', 'Мини-форматы', 'Sunscription Dark Spot Defence SPF50 Mini', '10 ml', 'EUR', 25.00, 17.00, 51.00, 12.75, 12.25, 49.0, 1020)
  ) as v(code, brand, category, name, size, currency, price, wholesale, price_per_4, average_cost, gross_profit, gross_margin, sort_order)
  on conflict (doctor_id, code) do nothing;
  get diagnostics added = row_count;
  return added;
end;
$$;

revoke all on function private.seed_shop(uuid) from public, anon, authenticated;

-- Every doctor with a catalogue gets the price lists (a new doctor: select private.seed_shop('<user id>');).
select private.seed_shop(d.doctor_id) from (select distinct doctor_id from public.preparations) d;

-- Backup: snapshots also cover the shop ------------------------------------------------------------
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

  return copied;
end;
$$;

revoke all on function backup.take_snapshot(text) from public, anon, authenticated;
