-- MVP 1b, task 1b-2 (P5): remember whether the doctor edited the post-procedure advice herself.
-- Run once in Supabase SQL Editor after 20261027000000_visit_items.sql. Safe to run more than once.
-- Only adds one nullable column. Nothing is changed or deleted.
--
-- null = visit saved before this column existed: the app treats non-empty advice as edited
-- (e.g. home-care advice copied from MVP 1a), so it is never replaced without «Обновить рекомендации?».
-- Old snapshots without the column restore as null, which means the same.

select backup.take_snapshot('før migrering 20261028000000_recommendations_edited.sql');

alter table public.visits add column if not exists recommendations_edited boolean;
