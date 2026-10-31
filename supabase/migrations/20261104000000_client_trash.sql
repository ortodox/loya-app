-- PR6: «Удалить клиента» – the client goes to «Удалённые клиенты» for 30 days and can be restored.
-- Run once in Supabase SQL Editor after 20261103000000_client_photos.sql. Safe to run more than once.
-- Only adds one nullable column and an index. Nothing is changed or deleted here.
--
-- The final deletion after 30 days (approved 31.10.2026) is done by the app, not by this migration:
-- it first removes the client's files through the Storage API, then deletes the client row, and the
-- existing «on delete cascade» foreign keys remove visits, courses, photos and documents rows.

select backup.take_snapshot('før migrering 20261104000000_client_trash.sql');

-- null = active client; a time = moved to «Удалённые клиенты» then.
alter table public.clients add column if not exists deleted_at timestamptz;

create index if not exists clients_deleted_idx on public.clients (doctor_id, deleted_at) where deleted_at is not null;
