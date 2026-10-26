-- MVP 1b, task 1b-2b (AN3): the date the doctor last confirmed «Анамнез без изменений ✓».
-- Run once in Supabase SQL Editor after 20261028000000_recommendations_edited.sql. Safe to run more than once.
-- Only adds one nullable column. Nothing is changed or deleted.
-- Planned visits (VP2) need no change: a visit dated after today is an appointment.

select backup.take_snapshot('før migrering 20261029000000_anamnesis_confirmed.sql');

alter table public.clients add column if not exists anamnesis_confirmed_at date;
