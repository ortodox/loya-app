-- MVP 1a, task 3: the rest of «Карта клиента» + Loya's feedback 22.10.2026 (PR1, PR5, JA1).
-- Run once in Supabase SQL Editor after 20261023000000_client_card.sql.

-- PR1: e-mail (needed for e-prescriptions) and place of permanent residence.
alter table public.clients
  add column email text
    check (email is null or email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  -- PR5: ISO 3166-1 alpha-2, e.g. 'PL'; the name is shown in the UI language.
  add column residence_country text
    check (residence_country is null or residence_country ~ '^[A-Z]{2}$'),
  add column residence_city text;

-- JA1/AN1/SK1/VI1/PH1: every clinical section lives in clients.anamnesis with flat keys from
-- src/config/kartaTemplate.ts. Fold the per-section columns from task 1 into it (no screen has
-- written to them, so this only guards against hand-entered data) and drop them.
update public.clients
set anamnesis = (
  coalesce(skin, '{}'::jsonb)
  || coalesce(aging, '{}'::jsonb)
  || coalesce(previous_procedures, '{}'::jsonb)
  || case
       when complaints is null or complaints = '{}'::jsonb then '{}'::jsonb
       else jsonb_build_object('complaints', complaints)
     end
  || anamnesis
)
where skin <> '{}'::jsonb
   or aging <> '{}'::jsonb
   or previous_procedures <> '{}'::jsonb
   or complaints <> '{}'::jsonb;

alter table public.clients
  drop column complaints,
  drop column skin,
  drop column aging,
  drop column previous_procedures;

-- Align with the data model in CLAUDE.md before visits are built (task 4, VS1).
alter table public.visits rename column home_care to home_care_recommendations;
