-- MVP 1a, task 2: client list and client card (PR1, PR2, AG1, PR3, AL2).
-- Run once in Supabase SQL Editor after 20261022000000_clients_visits.sql.

-- AG1: store the age as recorded at registration (or an exact birth date) and derive
-- the current age in the app. Replaces the approximate birth_year from task 1,
-- which no screen has written to yet.
alter table public.clients
  add column age_at_registration smallint
    check (age_at_registration between 0 and 130),
  add column birth_date date
    check (birth_date between date '1900-01-01' and date '2100-01-01'),
  drop column birth_year;

-- Registration date («Дата» in the card) is the reference point for AG1, so it must be set.
update public.clients set card_date = created_at::date where card_date is null;
alter table public.clients
  alter column card_date set not null,
  alter column card_date set default current_date;

-- PR1: language defaults to Russian.
alter table public.clients alter column language set default 'ru';

-- AN1/AL2: «Состояние здоровья» is called anamnesis in code (keys in src/config/card-template.ts).
alter table public.clients rename column health to anamnesis;
