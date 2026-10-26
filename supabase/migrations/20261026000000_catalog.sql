-- MVP 1b, task 1b-1: catalogue of procedure types, zones and preparations (B1, P1, P2, P3, P5, S2).
-- Run once in Supabase SQL Editor after 20261025000000_backup.sql. Safe to run more than once.
--
-- Principle (CLAUDE.md, preparaty_ru.md): advice, intervals, course, dose and follow-up are set per
-- PROCEDURE TYPE and inherited by its preparations. A preparation may override single field groups;
-- an empty (null) field on the preparation means «use the type's value».

select backup.take_snapshot('før migrering 20261026000000_catalog.sql');

-- zones ----------------------------------------------------------------------
create table if not exists public.zones (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  code text,                                   -- stable key for the seeded zones, null for own ones
  name jsonb not null check (length(btrim(name ->> 'ru')) > 0),   -- {ru, uk, pl, en}
  zone_group text not null check (zone_group in ('upper', 'middle', 'lower', 'body', 'other')),
  sort_order integer not null default 1000,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, doctor_id),
  unique (doctor_id, code)
);

-- procedure_types ------------------------------------------------------------
create table if not exists public.procedure_types (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  code text,                                   -- BT-01 … BT-10 for the seeded types, null for own ones
  name jsonb not null check (length(btrim(name ->> 'ru')) > 0),   -- {ru, uk, pl, en}
  sort_order integer not null default 1000,

  -- Defaults inherited by the preparations. Null = not filled in («заполнить»).
  dose_text text,                              -- e.g. '10–150', '1–4'
  dose_unit text,                              -- e.g. 'ед.', 'мл'
  course_min smallint check (course_min >= 1),
  course_max smallint check (course_max >= 1),
  interval_min smallint check (interval_min >= 1),
  interval_max smallint check (interval_max >= 1),
  interval_unit text check (interval_unit in ('days', 'weeks', 'months')),
  maintenance_min smallint check (maintenance_min >= 1),
  maintenance_max smallint check (maintenance_max >= 1),
  maintenance_unit text check (maintenance_unit in ('days', 'weeks', 'months')),
  maintenance_as_needed boolean,               -- «по показаниям»
  control_after_days smallint check (control_after_days >= 0),   -- 0 = no follow-up visit
  advice jsonb,                                -- {ru, uk, pl, en}: one line per recommendation
  advice_review text[],                        -- languages whose advice is a translation not yet checked

  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, doctor_id),
  unique (doctor_id, code),
  check (course_min <= course_max),
  check (interval_min <= interval_max),
  check (maintenance_min <= maintenance_max)
);

-- Allowed zones per procedure type (B1/Z3).
create table if not exists public.procedure_type_zones (
  doctor_id uuid not null default auth.uid(),
  procedure_type_id uuid not null,
  zone_id uuid not null,
  primary key (procedure_type_id, zone_id),
  foreign key (procedure_type_id, doctor_id)
    references public.procedure_types (id, doctor_id) on delete cascade,
  foreign key (zone_id, doctor_id) references public.zones (id, doctor_id) on delete cascade
);

-- preparations ---------------------------------------------------------------
create table if not exists public.preparations (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null default auth.uid(),
  procedure_type_id uuid not null,
  name text not null check (length(btrim(name)) > 0),
  manufacturer text,
  favorite boolean not null default false,

  -- Overrides (exceptions). Null = inherit from the procedure type.
  dose_text text,
  dose_unit text,
  course_min smallint check (course_min >= 1),
  course_max smallint check (course_max >= 1),
  interval_min smallint check (interval_min >= 1),
  interval_max smallint check (interval_max >= 1),
  interval_unit text check (interval_unit in ('days', 'weeks', 'months')),
  maintenance_min smallint check (maintenance_min >= 1),
  maintenance_max smallint check (maintenance_max >= 1),
  maintenance_unit text check (maintenance_unit in ('days', 'weeks', 'months')),
  maintenance_as_needed boolean,
  control_after_days smallint check (control_after_days >= 0),
  advice jsonb,
  advice_review text[],

  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, doctor_id),
  unique (doctor_id, procedure_type_id, name),
  check (course_min <= course_max),
  check (interval_min <= interval_max),
  check (maintenance_min <= maintenance_max),
  foreign key (procedure_type_id, doctor_id) references public.procedure_types (id, doctor_id)
);

create index if not exists procedure_type_zones_zone_idx on public.procedure_type_zones (zone_id);
create index if not exists preparations_type_idx on public.preparations (procedure_type_id);

create or replace trigger zones_set_updated_at
  before update on public.zones for each row execute function public.set_updated_at();
create or replace trigger procedure_types_set_updated_at
  before update on public.procedure_types for each row execute function public.set_updated_at();
create or replace trigger preparations_set_updated_at
  before update on public.preparations for each row execute function public.set_updated_at();

-- Row Level Security: owner only, and only after TOTP (aal2), like clients and visits ------------
alter table public.zones enable row level security;
alter table public.procedure_types enable row level security;
alter table public.procedure_type_zones enable row level security;
alter table public.preparations enable row level security;

revoke all on public.zones, public.procedure_types, public.procedure_type_zones, public.preparations from anon;
grant select, insert, update, delete
  on public.zones, public.procedure_types, public.procedure_type_zones, public.preparations
  to authenticated;

do $$
declare
  t text;
begin
  foreach t in array array['zones', 'procedure_types', 'procedure_type_zones', 'preparations'] loop
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = t || ': owner') then
      execute format(
        'create policy %I on public.%I for all to authenticated
           using (doctor_id = (select auth.uid())) with check (doctor_id = (select auth.uid()))',
        t || ': owner', t);
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = t || ': require mfa') then
      execute format(
        'create policy %I on public.%I as restrictive for all to authenticated
           using ((select auth.jwt() ->> ''aal'') = ''aal2'') with check ((select auth.jwt() ->> ''aal'') = ''aal2'')',
        t || ': require mfa', t);
    end if;
  end loop;
end;
$$;

-- Backup: snapshots now also cover the catalogue -------------------------------------------------
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

  return copied;
end;
$$;

revoke all on function backup.take_snapshot(text) from public, anon, authenticated;

-- Starting catalogue from preparaty_ru.md --------------------------------------------------------
-- private.seed_catalog(doctor) is idempotent: zones and types are matched on their code, and a
-- type's zones and preparations are only added when the type itself is new. Running it again never
-- duplicates anything and never overwrites or re-adds what the doctor has changed.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.seed_catalog(doctor uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.zones (doctor_id, code, name, zone_group, sort_order) values
    (doctor, 'forehead', '{"ru": "Лоб", "uk": "Лоб", "pl": "Czoło", "en": "Forehead"}'::jsonb, 'upper', 10),
    (doctor, 'glabella', '{"ru": "Межбровье (глабелла)", "uk": "Міжбрів''я (глабела)", "pl": "Gładzizna (glabella)", "en": "Glabella"}'::jsonb, 'upper', 20),
    (doctor, 'crows_feet', '{"ru": "«Гусиные лапки»", "uk": "«Гусячі лапки»", "pl": "Kurze łapki", "en": "Crow''s feet"}'::jsonb, 'upper', 30),
    (doctor, 'periorbital', '{"ru": "Периорбитальная зона", "uk": "Періорбітальна зона", "pl": "Okolica okołooczodołowa", "en": "Periorbital area"}'::jsonb, 'upper', 40),
    (doctor, 'cheekbones', '{"ru": "Скулы", "uk": "Вилиці", "pl": "Kości policzkowe", "en": "Cheekbones"}'::jsonb, 'middle', 50),
    (doctor, 'cheeks', '{"ru": "Щёки", "uk": "Щоки", "pl": "Policzki", "en": "Cheeks"}'::jsonb, 'middle', 60),
    (doctor, 'nasolabial', '{"ru": "Носогубные складки", "uk": "Носогубні складки", "pl": "Bruzdy nosowo-wargowe", "en": "Nasolabial folds"}'::jsonb, 'middle', 70),
    (doctor, 'tear_trough', '{"ru": "Слёзная борозда", "uk": "Слізна борозна", "pl": "Dolina łez", "en": "Tear trough"}'::jsonb, 'middle', 80),
    (doctor, 'nasolacrimal', '{"ru": "Носослёзная зона", "uk": "Носослізна зона", "pl": "Okolica nosowo-łzowa", "en": "Nasojugal area"}'::jsonb, 'middle', 90),
    (doctor, 'nose', '{"ru": "Нос", "uk": "Ніс", "pl": "Nos", "en": "Nose"}'::jsonb, 'middle', 100),
    (doctor, 'lips', '{"ru": "Губы", "uk": "Губи", "pl": "Usta", "en": "Lips"}'::jsonb, 'lower', 110),
    (doctor, 'perioral', '{"ru": "Кисетные морщины", "uk": "Кисетні зморшки", "pl": "Zmarszczki palacza", "en": "Perioral lines"}'::jsonb, 'lower', 120),
    (doctor, 'chin', '{"ru": "Подбородок", "uk": "Підборіддя", "pl": "Broda", "en": "Chin"}'::jsonb, 'lower', 130),
    (doctor, 'jawline', '{"ru": "Линия челюсти", "uk": "Лінія щелепи", "pl": "Linia żuchwy", "en": "Jawline"}'::jsonb, 'lower', 140),
    (doctor, 'masseter', '{"ru": "Жевательные мышцы", "uk": "Жувальні м''язи", "pl": "Mięśnie żwacze", "en": "Masseter muscles"}'::jsonb, 'lower', 150),
    (doctor, 'neck', '{"ru": "Шея", "uk": "Шия", "pl": "Szyja", "en": "Neck"}'::jsonb, 'body', 160),
    (doctor, 'decollete', '{"ru": "Декольте", "uk": "Декольте", "pl": "Dekolt", "en": "Décolletage"}'::jsonb, 'body', 170),
    (doctor, 'chest', '{"ru": "Грудь", "uk": "Груди", "pl": "Piersi", "en": "Chest"}'::jsonb, 'body', 180),
    (doctor, 'abdomen', '{"ru": "Живот", "uk": "Живіт", "pl": "Brzuch", "en": "Abdomen"}'::jsonb, 'body', 190),
    (doctor, 'back', '{"ru": "Спина", "uk": "Спина", "pl": "Plecy", "en": "Back"}'::jsonb, 'body', 200),
    (doctor, 'trapezius', '{"ru": "Трапеция", "uk": "Трапеція", "pl": "Mięsień czworoboczny", "en": "Trapezius"}'::jsonb, 'body', 210),
    (doctor, 'armpits', '{"ru": "Подмышки", "uk": "Пахви", "pl": "Pachy", "en": "Armpits"}'::jsonb, 'body', 220),
    (doctor, 'hands', '{"ru": "Кисти рук", "uk": "Кисті рук", "pl": "Dłonie", "en": "Hands"}'::jsonb, 'body', 230),
    (doctor, 'full_face', '{"ru": "Лицо (всё)", "uk": "Обличчя (усе)", "pl": "Cała twarz", "en": "Full face"}'::jsonb, 'other', 240),
    (doctor, 'scalp', '{"ru": "Кожа головы", "uk": "Шкіра голови", "pl": "Skóra głowy", "en": "Scalp"}'::jsonb, 'other', 250)
  on conflict (doctor_id, code) do nothing;

  with new_types as (
    insert into public.procedure_types (doctor_id, code, name, sort_order, dose_text, dose_unit, course_min, course_max, interval_min, interval_max, interval_unit, maintenance_min, maintenance_max, maintenance_unit, maintenance_as_needed, control_after_days, advice, advice_review) values
      (doctor, 'BT-01', '{"ru": "Ботулинотерапия", "uk": "Ботулінотерапія", "pl": "Toksyna botulinowa", "en": "Botulinum therapy"}'::jsonb, 10, '10–150', 'ед.', '1', '1', null, null, null, '4', '4', 'months', false, '14', '{"ru": "Не ложиться и не наклонять голову вниз в течение 4 часов.\nНе трогать и не массировать зоны инъекций 24 часа.\nИзбегать спорта, сауны, бани, солярия и алкоголя 24–48 часов.\nНе делать массаж лица и аппаратные процедуры 2 недели.\nЭффект появляется через 3–7 дней, полный – через 14 дней.\nКонтрольный визит через 14 дней.", "uk": "Не лягати й не нахиляти голову вниз протягом 4 годин.\nНе торкатися й не масажувати зони ін''єкцій 24 години.\nУникати спорту, сауни, лазні, солярію та алкоголю 24–48 годин.\nНе робити масаж обличчя та апаратні процедури 2 тижні.\nЕфект з''являється через 3–7 днів, повний – через 14 днів.\nКонтрольний візит через 14 днів.", "pl": "Nie kłaść się i nie pochylać głowy przez 4 godziny.\nNie dotykać i nie masować miejsc wstrzyknięć przez 24 godziny.\nUnikać sportu, sauny, łaźni, solarium i alkoholu przez 24–48 godzin.\nNie wykonywać masażu twarzy ani zabiegów aparaturowych przez 2 tygodnie.\nEfekt pojawia się po 3–7 dniach, pełny – po 14 dniach.\nWizyta kontrolna po 14 dniach.", "en": "Do not lie down or bend your head down for 4 hours.\nDo not touch or massage the injection areas for 24 hours.\nAvoid exercise, sauna, steam bath, sunbeds and alcohol for 24–48 hours.\nNo facial massage or device treatments for 2 weeks.\nThe effect appears after 3–7 days, the full effect after 14 days.\nFollow-up visit after 14 days."}'::jsonb, array['uk','pl','en']),
      (doctor, 'BT-02', '{"ru": "Контурная пластика (филлеры)", "uk": "Контурна пластика (філери)", "pl": "Wypełniacze (modelowanie konturu)", "en": "Dermal fillers"}'::jsonb, 20, '1', 'мл', '1', '1', null, null, null, '9', '12', 'months', false, '14', '{"ru": "Не наносить макияж 12 часов.\nИзбегать спорта, сауны, бани и солярия 1–2 недели.\nНе употреблять алкоголь 24 часа.\nНе давить на зону и не спать лицом вниз 2–3 дня.\nОтёк и небольшие синяки возможны 3–7 дней.\nПри сильной боли, побледнении кожи или нарушении зрения – немедленно связаться с врачом.\nКонтрольный визит через 14 дней.", "uk": "Не наносити макіяж 12 годин.\nУникати спорту, сауни, лазні та солярію 1–2 тижні.\nНе вживати алкоголь 24 години.\nНе тиснути на зону й не спати обличчям донизу 2–3 дні.\nНабряк і невеликі синці можливі 3–7 днів.\nУ разі сильного болю, зблідніння шкіри або порушення зору – негайно зв''язатися з лікарем.\nКонтрольний візит через 14 днів.", "pl": "Nie nakładać makijażu przez 12 godzin.\nUnikać sportu, sauny, łaźni i solarium przez 1–2 tygodnie.\nNie pić alkoholu przez 24 godziny.\nNie uciskać okolicy i nie spać na brzuchu twarzą w dół przez 2–3 dni.\nObrzęk i niewielkie siniaki mogą utrzymywać się 3–7 dni.\nW razie silnego bólu, zblednięcia skóry lub zaburzeń widzenia – natychmiast skontaktować się z lekarzem.\nWizyta kontrolna po 14 dniach.", "en": "No make-up for 12 hours.\nAvoid exercise, sauna, steam bath and sunbeds for 1–2 weeks.\nNo alcohol for 24 hours.\nDo not press on the area or sleep face down for 2–3 days.\nSwelling and small bruises are possible for 3–7 days.\nIn case of severe pain, skin blanching or vision problems, contact the doctor immediately.\nFollow-up visit after 14 days."}'::jsonb, array['uk','pl','en']),
      (doctor, 'BT-03', '{"ru": "Биоревитализация / ремоделирование", "uk": "Біоревіталізація / ремоделювання", "pl": "Biorewitalizacja / remodelowanie", "en": "Biorevitalisation / remodelling"}'::jsonb, 30, '2', 'мл', '2', '2', '4', '4', 'weeks', '4', '6', 'months', false, '0', '{"ru": "Не наносить макияж 12 часов.\nИзбегать сауны, бани и интенсивного спорта 48 часов.\nНебольшие папулы в точках инъекций исчезают в течение 24 часов.\nВторая процедура через 4 недели.", "uk": "Не наносити макіяж 12 годин.\nУникати сауни, лазні та інтенсивного спорту 48 годин.\nНевеликі папули в точках ін''єкцій зникають протягом 24 годин.\nДруга процедура через 4 тижні.", "pl": "Nie nakładać makijażu przez 12 godzin.\nUnikać sauny, łaźni i intensywnego sportu przez 48 godzin.\nNiewielkie grudki w miejscach wkłuć znikają w ciągu 24 godzin.\nDrugi zabieg po 4 tygodniach.", "en": "No make-up for 12 hours.\nAvoid sauna, steam bath and intense exercise for 48 hours.\nSmall bumps at the injection points disappear within 24 hours.\nSecond treatment after 4 weeks."}'::jsonb, array['uk','pl','en']),
      (doctor, 'BT-04', '{"ru": "Биорепарация (полинуклеотиды)", "uk": "Біорепарація (полінуклеотиди)", "pl": "Bioreparacja (polinukleotydy)", "en": "Bioreparation (polynucleotides)"}'::jsonb, 40, '2', 'мл', '3', '3', '2', '4', 'weeks', '6', '6', 'months', false, '0', '{"ru": "Не наносить макияж 24 часа.\nИзбегать сауны, бани, бассейна и алкоголя 2–3 дня.\nПапулы в точках инъекций могут сохраняться 1–3 дня.\nИспользовать SPF 50 ежедневно.", "uk": "Не наносити макіяж 24 години.\nУникати сауни, лазні, басейну та алкоголю 2–3 дні.\nПапули в точках ін''єкцій можуть зберігатися 1–3 дні.\nВикористовувати SPF 50 щодня.", "pl": "Nie nakładać makijażu przez 24 godziny.\nUnikać sauny, łaźni, basenu i alkoholu przez 2–3 dni.\nGrudki w miejscach wkłuć mogą utrzymywać się 1–3 dni.\nCodziennie stosować SPF 50.", "en": "No make-up for 24 hours.\nAvoid sauna, steam bath, swimming pool and alcohol for 2–3 days.\nBumps at the injection points may last 1–3 days.\nUse SPF 50 daily."}'::jsonb, array['uk','pl','en']),
      (doctor, 'BT-05', '{"ru": "Мезотерапия", "uk": "Мезотерапія", "pl": "Mezoterapia", "en": "Mesotherapy"}'::jsonb, 50, '3', 'мл', '3', '5', '1', '2', 'weeks', '3', '4', 'months', false, '0', '{"ru": "Не наносить макияж 12–24 часа.\nИзбегать сауны, бани и солярия 2–3 дня.\nНе умываться горячей водой в день процедуры.\nИспользовать SPF 50 ежедневно.", "uk": "Не наносити макіяж 12–24 години.\nУникати сауни, лазні та солярію 2–3 дні.\nНе вмиватися гарячою водою в день процедури.\nВикористовувати SPF 50 щодня.", "pl": "Nie nakładać makijażu przez 12–24 godziny.\nUnikać sauny, łaźni i solarium przez 2–3 dni.\nW dniu zabiegu nie myć twarzy gorącą wodą.\nCodziennie stosować SPF 50.", "en": "No make-up for 12–24 hours.\nAvoid sauna, steam bath and sunbeds for 2–3 days.\nDo not wash your face with hot water on the day of the treatment.\nUse SPF 50 daily."}'::jsonb, array['uk','pl','en']),
      (doctor, 'BT-06', '{"ru": "Экзосомальная терапия", "uk": "Екзосомальна терапія", "pl": "Terapia egzosomowa", "en": "Exosome therapy"}'::jsonb, 60, '1', 'флакон', '3', '5', '2', '3', 'weeks', '3', '6', 'months', false, '0', '{"ru": "Не умываться 6–12 часов (если процедура с микронидлингом).\nНе наносить макияж 24 часа.\nИзбегать сауны, бани, бассейна и спорта 2–3 дня.\nИспользовать только мягкий уход и SPF 50.\nНе использовать ретиноиды и кислоты 5–7 дней.", "uk": "Не вмиватися 6–12 годин (якщо процедура з мікронідлінгом).\nНе наносити макіяж 24 години.\nУникати сауни, лазні, басейну та спорту 2–3 дні.\nВикористовувати лише м''який догляд і SPF 50.\nНе використовувати ретиноїди та кислоти 5–7 днів.", "pl": "Nie myć twarzy przez 6–12 godzin (jeśli zabieg był z mikronakłuwaniem).\nNie nakładać makijażu przez 24 godziny.\nUnikać sauny, łaźni, basenu i sportu przez 2–3 dni.\nStosować wyłącznie łagodną pielęgnację i SPF 50.\nNie stosować retinoidów ani kwasów przez 5–7 dni.", "en": "Do not wash your face for 6–12 hours (if the treatment included microneedling).\nNo make-up for 24 hours.\nAvoid sauna, steam bath, swimming pool and exercise for 2–3 days.\nUse only gentle skincare and SPF 50.\nDo not use retinoids or acids for 5–7 days."}'::jsonb, array['uk','pl','en']),
      (doctor, 'BT-07', '{"ru": "Химический пилинг", "uk": "Хімічний пілінг", "pl": "Peeling chemiczny", "en": "Chemical peel"}'::jsonb, 70, '1–4', 'слоя', '4', '6', '1', '1', 'weeks', null, null, null, true, '0', '{"ru": "Не использовать скрабы, кислоты и ретиноиды 3 дня.\nАктивно увлажнять кожу.\nИспользовать SPF 50 ежедневно.\nЛёгкое шелушение возможно на 2–3 день.", "uk": "Не використовувати скраби, кислоти та ретиноїди 3 дні.\nАктивно зволожувати шкіру.\nВикористовувати SPF 50 щодня.\nЛегке лущення можливе на 2–3 день.", "pl": "Nie stosować peelingów mechanicznych, kwasów ani retinoidów przez 3 dni.\nIntensywnie nawilżać skórę.\nCodziennie stosować SPF 50.\nLekkie złuszczanie może wystąpić w 2.–3. dniu.", "en": "Do not use scrubs, acids or retinoids for 3 days.\nMoisturise the skin well.\nUse SPF 50 daily.\nLight peeling is possible on day 2–3."}'::jsonb, array['uk','pl','en']),
      (doctor, 'BT-08', '{"ru": "Чистка лица", "uk": "Чистка обличчя", "pl": "Oczyszczanie twarzy", "en": "Facial cleansing"}'::jsonb, 80, '–', null, '1', '1', null, null, null, '4', '6', 'weeks', true, '0', '{"ru": "Не трогать лицо руками в течение дня.\nИзбегать сауны и бассейна 24 часа.", "uk": "Не торкатися обличчя руками протягом дня.\nУникати сауни та басейну 24 години.", "pl": "Nie dotykać twarzy rękami przez cały dzień.\nUnikać sauny i basenu przez 24 godziny.", "en": "Do not touch your face with your hands for the rest of the day.\nAvoid sauna and swimming pool for 24 hours."}'::jsonb, array['uk','pl','en']),
      (doctor, 'BT-09', '{"ru": "PRP-терапия (плазмотерапия)", "uk": "PRP-терапія (плазмотерапія)", "pl": "Terapia PRP (osocze bogatopłytkowe)", "en": "PRP therapy (plasma therapy)"}'::jsonb, 90, '3–5', 'мл', '3', '4', '4', '4', 'weeks', '6', '12', 'months', false, '0', '{"ru": "Не умываться 6 часов.\nНе наносить макияж 24 часа.\nИзбегать сауны, бани, спорта и алкоголя 2–3 дня.\nИспользовать SPF 50 ежедневно.", "uk": "Не вмиватися 6 годин.\nНе наносити макіяж 24 години.\nУникати сауни, лазні, спорту та алкоголю 2–3 дні.\nВикористовувати SPF 50 щодня.", "pl": "Nie myć twarzy przez 6 godzin.\nNie nakładać makijażu przez 24 godziny.\nUnikać sauny, łaźni, sportu i alkoholu przez 2–3 dni.\nCodziennie stosować SPF 50.", "en": "Do not wash your face for 6 hours.\nNo make-up for 24 hours.\nAvoid sauna, steam bath, exercise and alcohol for 2–3 days.\nUse SPF 50 daily."}'::jsonb, array['uk','pl','en']),
      (doctor, 'BT-10', '{"ru": "Коллагеностимуляция", "uk": "Колагеностимуляція", "pl": "Stymulacja kolagenu", "en": "Collagen stimulation"}'::jsonb, 100, null, null, null, null, null, null, null, null, null, null, null, null, null, null)
    on conflict (doctor_id, code) do nothing
    returning id, code
  ),
  new_links as (
    insert into public.procedure_type_zones (doctor_id, procedure_type_id, zone_id)
    select doctor, t.id, z.id
    from new_types t
    join (values
      ('BT-01', 'forehead'),
      ('BT-01', 'glabella'),
      ('BT-01', 'crows_feet'),
      ('BT-01', 'perioral'),
      ('BT-01', 'chin'),
      ('BT-01', 'neck'),
      ('BT-01', 'masseter'),
      ('BT-01', 'trapezius'),
      ('BT-01', 'armpits'),
      ('BT-02', 'lips'),
      ('BT-02', 'nasolabial'),
      ('BT-02', 'cheekbones'),
      ('BT-02', 'chin'),
      ('BT-02', 'jawline'),
      ('BT-02', 'tear_trough'),
      ('BT-02', 'nasolacrimal'),
      ('BT-03', 'full_face'),
      ('BT-03', 'neck'),
      ('BT-03', 'decollete'),
      ('BT-03', 'hands'),
      ('BT-04', 'full_face'),
      ('BT-04', 'periorbital'),
      ('BT-04', 'neck'),
      ('BT-04', 'decollete'),
      ('BT-05', 'full_face'),
      ('BT-05', 'periorbital'),
      ('BT-05', 'neck'),
      ('BT-05', 'decollete'),
      ('BT-05', 'scalp'),
      ('BT-06', 'full_face'),
      ('BT-06', 'neck'),
      ('BT-06', 'decollete'),
      ('BT-06', 'scalp'),
      ('BT-06', 'abdomen'),
      ('BT-06', 'chest'),
      ('BT-07', 'full_face'),
      ('BT-07', 'neck'),
      ('BT-07', 'decollete'),
      ('BT-07', 'back'),
      ('BT-08', 'full_face'),
      ('BT-08', 'back'),
      ('BT-09', 'full_face'),
      ('BT-09', 'neck'),
      ('BT-09', 'decollete'),
      ('BT-09', 'scalp')
    ) as m (type_code, zone_code) on m.type_code = t.code
    join public.zones z on z.doctor_id = doctor and z.code = m.zone_code
    on conflict do nothing
    returning 1
  )
  insert into public.preparations (doctor_id, procedure_type_id, name, manufacturer, favorite,
    course_min, course_max, interval_min, interval_max, interval_unit, advice, advice_review)
  select doctor, t.id, p.name, p.manufacturer, p.favorite,
    p.course_min::smallint, p.course_max::smallint, p.interval_min::smallint, p.interval_max::smallint,
    p.interval_unit, p.advice, p.advice_review
  from new_types t
  join (values
      ('BT-01', 'Botox', 'Allergan', true, null, null, null, null, null, null, null),
      ('BT-01', 'Vistabel', null, false, null, null, null, null, null, null, null),
      ('BT-01', 'Dysport', null, false, null, null, null, null, null, null, null),
      ('BT-01', 'Azzalure', null, false, null, null, null, null, null, null, null),
      ('BT-01', 'Alluzience', null, false, null, null, null, null, null, null, null),
      ('BT-01', 'Xeomin', null, false, null, null, null, null, null, null, null),
      ('BT-01', 'Bocouture', null, false, null, null, null, null, null, null, null),
      ('BT-01', 'Letybo', null, false, null, null, null, null, null, null, null),
      ('BT-01', 'Relfydess', null, false, null, null, null, null, null, null, null),
      ('BT-01', 'Nuceiva', null, false, null, null, null, null, null, null, null),
      ('BT-01', 'Nabota', null, false, null, null, null, null, null, null, null),
      ('BT-02', 'Stylage M Bi Soft lido', null, true, null, null, null, null, null, null, null),
      ('BT-02', 'Juvederm Smile', null, true, null, null, null, null, null, null, null),
      ('BT-02', 'Juvederm', null, false, null, null, null, null, null, null, null),
      ('BT-02', 'Stylage M (с лидокаином)', null, false, null, null, null, null, null, null, null),
      ('BT-02', 'Stylage M (без лидокаина)', null, false, null, null, null, null, null, null, null),
      ('BT-02', 'Teosyal', null, false, null, null, null, null, null, null, null),
      ('BT-02', 'Restylane', null, false, null, null, null, null, null, null, null),
      ('BT-02', 'Restylane Kysse', null, false, null, null, null, null, null, null, null),
      ('BT-02', 'Juvéderm Volift', null, false, null, null, null, null, null, null, null),
      ('BT-02', 'Belotero', null, false, null, null, null, null, null, null, null),
      ('BT-02', 'Revolax', null, false, null, null, null, null, null, null, null),
      ('BT-02', 'Neuramis', null, false, null, null, null, null, null, null, null),
      ('BT-02', 'Saypha', null, false, null, null, null, null, null, null, null),
      ('BT-02', 'Aliaxin', null, false, null, null, null, null, null, null, null),
      ('BT-02', 'Evanthia', null, false, null, null, null, null, null, null, null),
      ('BT-03', 'Profhilo', null, false, null, null, null, null, null, null, null),
      ('BT-03', 'Profhilo Structura', null, false, null, null, null, null, null, null, null),
      ('BT-03', 'Meso-Wharton P199', null, false, null, null, null, null, null, null, null),
      ('BT-03', 'Meso-Xanthin F199', null, false, null, null, null, null, null, null, null),
      ('BT-03', 'Jalupro Classic', null, false, null, null, null, null, null, null, null),
      ('BT-03', 'Jalupro HMW', null, false, null, null, null, null, null, null, null),
      ('BT-03', 'Jalupro Super Hydro', null, false, null, null, null, null, null, null, null),
      ('BT-03', 'Sunekos 200', null, false, null, null, null, null, null, null, null),
      ('BT-03', 'Sunekos 1200', null, false, null, null, null, null, null, null, null),
      ('BT-03', 'Teosyal Redensity 1', null, false, null, null, null, null, null, null, null),
      ('BT-03', 'Teosyal PureSense Redensity 1', null, false, null, null, null, null, null, null, null),
      ('BT-03', 'Teosyal Meso', null, false, null, null, null, null, null, null, null),
      ('BT-03', 'Restylane Vital', null, false, null, null, null, null, null, null, null),
      ('BT-03', 'Restylane Vital Light', null, false, null, null, null, null, null, null, null),
      ('BT-03', 'Restylane Skinboosters', null, false, null, null, null, null, null, null, null),
      ('BT-03', 'Restylane Skinboosters Vital', null, false, null, null, null, null, null, null, null),
      ('BT-03', 'Cytocare 532', null, false, null, null, null, null, null, null, null),
      ('BT-03', 'Cytocare 516', null, false, null, null, null, null, null, null, null),
      ('BT-03', 'RRS HA Injectable', null, false, null, null, null, null, null, null, null),
      ('BT-03', 'Juvéderm Volite', null, false, null, null, null, null, null, null, null),
      ('BT-03', 'Viscoderm Hydrobooster', null, false, null, null, null, null, null, null, null),
      ('BT-03', 'Ejal 40', null, false, null, null, null, null, null, null, null),
      ('BT-03', 'Xela Rederm 1.1%', null, false, null, null, null, null, null, null, null),
      ('BT-03', 'Xela Rederm 1.8%', null, false, null, null, null, null, null, null, null),
      ('BT-03', 'Neauvia Hydro Deluxe', null, false, null, null, null, null, null, null, null),
      ('BT-03', 'Aquashine', null, false, null, null, null, null, null, null, null),
      ('BT-03', 'Aquashine BR', null, false, null, null, null, null, null, null, null),
      ('BT-03', 'Revofil Aquashine Soft Filler', null, false, null, null, null, null, null, null, null),
      ('BT-03', 'Stylage Hydro', null, false, null, null, null, null, null, null, null),
      ('BT-03', 'Belotero Revive', null, false, null, null, null, null, null, null, null),
      ('BT-03', 'Saypha Rich', null, false, null, null, null, null, null, null, null),
      ('BT-04', 'Phlynage Strong', null, true, null, null, null, null, null, null, null),
      ('BT-04', 'Phlynage Thin', null, false, null, null, null, null, null, null, null),
      ('BT-04', 'Rejuran Healer', null, false, null, null, null, null, null, null, null),
      ('BT-04', 'Rejuran I', null, false, null, null, null, null, null, null, null),
      ('BT-04', 'Rejuran HB', null, false, null, null, null, null, null, null, null),
      ('BT-04', 'Plinest', null, false, null, null, null, null, null, null, null),
      ('BT-04', 'Plinest Eye', null, false, null, null, null, null, null, null, null),
      ('BT-04', 'Newest', null, false, null, null, null, null, null, null, null),
      ('BT-04', 'PhilArt', null, false, null, null, null, null, null, null, null),
      ('BT-04', 'Vitaran', null, false, null, null, null, null, null, null, null),
      ('BT-04', 'Mastelli PN (линейка)', null, false, null, null, null, null, null, null, null),
      ('BT-05', 'MesoEye C71', null, true, null, null, null, null, null, null, null),
      ('BT-05', 'Filorga NCTF 135 HA', null, false, null, null, null, null, null, null, null),
      ('BT-06', 'Revive NX', null, false, null, null, null, null, null, null, null),
      ('BT-06', 'Revive HS', null, false, null, null, null, null, null, null, null),
      ('BT-06', 'ASCE+', 'ExoCoBio', false, null, null, null, null, null, null, null),
      ('BT-07', 'PRX-T33', null, false, null, null, null, null, null, null, null),
      ('BT-07', 'Миндальный пилинг 40%', null, false, '6', '8', '7', '10', 'days', '{"ru": "Не использовать скрабы, кислоты и ретиноиды 7 дней.\nИзбегать активного солнца 2 недели, SPF 50 ежедневно.\nНе посещать сауну и баню 3–5 дней.\nШелушение не удалять механически.", "uk": "Не використовувати скраби, кислоти та ретиноїди 7 днів.\nУникати активного сонця 2 тижні, SPF 50 щодня.\nНе відвідувати сауну й лазню 3–5 днів.\nЛущення не видаляти механічно.", "pl": "Nie stosować peelingów mechanicznych, kwasów ani retinoidów przez 7 dni.\nUnikać intensywnego słońca przez 2 tygodnie, codziennie SPF 50.\nNie korzystać z sauny i łaźni przez 3–5 dni.\nNie usuwać złuszczającego się naskórka mechanicznie.", "en": "Do not use scrubs, acids or retinoids for 7 days.\nAvoid strong sun for 2 weeks, SPF 50 daily.\nNo sauna or steam bath for 3–5 days.\nDo not remove peeling skin mechanically."}'::jsonb, array['uk','pl','en']),
      ('BT-07', 'BioRePeelCl3', null, false, null, null, null, null, null, null, null),
      ('BT-07', 'Mediderma', null, false, null, null, null, null, null, null, null),
      ('BT-07', 'Mesoestetic', null, false, null, null, null, null, null, null, null),
      ('BT-07', 'Dermaceutic', null, false, null, null, null, null, null, null, null),
      ('BT-07', 'MeLine', null, false, null, null, null, null, null, null, null),
      ('BT-07', 'ZO Skin Health', null, false, null, null, null, null, null, null, null),
      ('BT-07', 'Glymed', null, false, null, null, null, null, null, null, null),
      ('BT-08', 'Institut Esthederm', null, false, null, null, null, null, null, null, null),
      ('BT-09', 'PRP (собственная плазма)', null, false, null, null, null, null, null, null, null),
      ('BT-10', 'ZQ-II', null, true, null, null, null, null, null, null, null),
      ('BT-10', 'Sculptra', null, false, null, null, null, null, null, null, null),
      ('BT-10', 'Radiesse', null, false, null, null, null, null, null, null, null),
      ('BT-10', 'Ellansé', null, false, null, null, null, null, null, null, null),
      ('BT-10', 'AestheFill', null, false, null, null, null, null, null, null, null),
      ('BT-10', 'Gouri', null, false, null, null, null, null, null, null, null),
      ('BT-10', 'Juvelook', null, false, null, null, null, null, null, null, null),
      ('BT-10', 'Lenisna', null, false, null, null, null, null, null, null, null)
  ) as p (type_code, name, manufacturer, favorite, course_min, course_max, interval_min, interval_max,
          interval_unit, advice, advice_review) on p.type_code = t.code
  on conflict (doctor_id, procedure_type_id, name) do nothing;
end;
$$;

revoke all on function private.seed_catalog(uuid) from public, anon, authenticated;

-- Seed every existing doctor (auth.users). New doctors later: select private.seed_catalog('<user id>');
select private.seed_catalog(id) from auth.users;
