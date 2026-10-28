-- MVP 1b, task 1b-3 (Z5): the face scheme drawn in a visit, stored as strokes (not an image).
-- Run once in Supabase SQL Editor after 20261031000000_care_documents.sql. Safe to run more than once.
-- Only adds one nullable column. Nothing is changed or deleted.
--
-- Shape: {"template": "front", "strokes": [{"color": "dark", "width": 0.006, "points": [[0.42, 0.31], …]}]}
-- Coordinates are normalised 0–1 to the template, so the drawing scales to any screen.

select backup.take_snapshot('før migrering 20261101000000_face_scheme.sql');

alter table public.visits add column if not exists face_scheme jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'visits_face_scheme_check') then
    alter table public.visits add constraint visits_face_scheme_check
      check (face_scheme is null or coalesce(jsonb_typeof(face_scheme -> 'strokes') = 'array', false));
  end if;
end;
$$;
