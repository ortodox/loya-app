-- MVP 1a: «Карта клиента» (clients) and appended visits (visits).
-- Access: only the owning doctor (doctor_id = auth.uid()), and only after TOTP (aal2).

-- Shared trigger for updated_at --------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- clients --------------------------------------------------------------------
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null default auth.uid() references auth.users (id) on delete cascade,

  -- 1. Карта клиента. Only the name is required (PR1).
  full_name text not null check (length(btrim(full_name)) > 0),
  card_date date default current_date,
  -- Approximate year of birth, so the card always shows the current age (AG1).
  birth_year smallint check (birth_year between 1900 and 2100),
  phone text,
  language text check (language in ('ru', 'uk', 'pl', 'en')),

  -- Sections with quick choice + free text + uncertainty (JA1, AN1–AN2, SK1, VI1, PH1).
  -- Kept as jsonb until the card template is defined in the next task.
  complaints jsonb not null default '{}'::jsonb,           -- Жалобы
  health jsonb not null default '{}'::jsonb,               -- 2. Состояние здоровья
  skin jsonb not null default '{}'::jsonb,                 -- 3. Состояние кожи
  aging jsonb not null default '{}'::jsonb,                -- 4. Возрастные изменения
  previous_procedures jsonb not null default '{}'::jsonb,  -- 5. Ранее проведённые процедуры

  notes text,  -- Free notes (PR3)

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Lets visits reference (id, doctor_id) so a visit can never point at another doctor's client.
  unique (id, doctor_id)
);

create index clients_doctor_name_idx on public.clients (doctor_id, full_name);

create trigger clients_set_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();

-- visits (6. Визиты, newest first in the UI – VS1) ---------------------------
create table public.visits (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null,
  doctor_id uuid not null default auth.uid(),
  visit_date date not null default current_date,
  home_care text,       -- Рекомендации по уходу дома
  procedure_plan text,  -- План процедур
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  foreign key (client_id, doctor_id)
    references public.clients (id, doctor_id) on delete cascade
);

create index visits_client_date_idx on public.visits (client_id, visit_date desc);
create index visits_doctor_idx on public.visits (doctor_id);

create trigger visits_set_updated_at
  before update on public.visits
  for each row execute function public.set_updated_at();

-- Row Level Security ---------------------------------------------------------
alter table public.clients enable row level security;
alter table public.visits enable row level security;

revoke all on public.clients, public.visits from anon;
grant select, insert, update, delete on public.clients, public.visits to authenticated;

-- Owner policies: a doctor sees and changes only their own rows.
create policy "clients: owner" on public.clients
  for all to authenticated
  using (doctor_id = (select auth.uid()))
  with check (doctor_id = (select auth.uid()));

create policy "visits: owner" on public.visits
  for all to authenticated
  using (doctor_id = (select auth.uid()))
  with check (doctor_id = (select auth.uid()));

-- Restrictive policies: no access with an aal1 session, even with a valid login (L1).
create policy "clients: require mfa" on public.clients
  as restrictive for all to authenticated
  using ((select auth.jwt() ->> 'aal') = 'aal2')
  with check ((select auth.jwt() ->> 'aal') = 'aal2');

create policy "visits: require mfa" on public.visits
  as restrictive for all to authenticated
  using ((select auth.jwt() ->> 'aal') = 'aal2')
  with check ((select auth.jwt() ->> 'aal') = 'aal2');
