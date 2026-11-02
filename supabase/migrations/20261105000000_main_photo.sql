-- FK6: «Главное фото» – the doctor marks one photo in «Фото клиента» as the client's picture in the
-- list and the card (or none: then initials are shown).
-- Run once in Supabase SQL Editor after 20261104000000_client_trash.sql. Safe to run more than once.
-- Only adds one nullable column, one unique constraint and one foreign key. Nothing is changed or deleted.

select backup.take_snapshot('før migrering 20261105000000_main_photo.sql');

-- null = no main photo (initials).
alter table public.clients add column if not exists main_photo_id uuid;

do $$
begin
  -- Lets the foreign key below check that the photo belongs to the same client.
  if not exists (select 1 from pg_constraint where conname = 'client_photos_id_client_key') then
    alter table public.client_photos add constraint client_photos_id_client_key unique (id, client_id);
  end if;
  -- The main photo must be one of the client's own photos. Deleting the photo clears the choice.
  -- Deferred: a restore from backup (docs/BACKUP.md) inserts clients before their photos.
  if not exists (select 1 from pg_constraint where conname = 'clients_main_photo_fkey') then
    alter table public.clients add constraint clients_main_photo_fkey
      foreign key (main_photo_id, id) references public.client_photos (id, client_id)
      on delete set null (main_photo_id)
      deferrable initially deferred;
  end if;
end;
$$;
