-- Simple in-database backup: daily snapshots of public.clients and public.visits.
-- See docs/BACKUP.md. Run in Supabase SQL Editor. Safe to run more than once.
--
-- The backup schema is NOT exposed through the Supabase Data API (only `public` is), and
-- anon/authenticated get no privileges on it, so the app can neither read nor write backups.

create schema if not exists backup;

create table if not exists backup.snapshots (
  id bigint generated always as identity primary key,
  taken_at timestamptz not null,
  reason text not null,
  table_name text not null,
  row_data jsonb not null
);

create index if not exists snapshots_taken_at_idx on backup.snapshots (taken_at);
create index if not exists snapshots_row_id_idx on backup.snapshots (table_name, (row_data ->> 'id'));

-- Copies every row of public.clients and public.visits, all with the same taken_at.
-- Returns the number of rows copied.
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
  select snapshot_time, take_snapshot.reason, 'clients', to_jsonb(c)
  from public.clients c;
  get diagnostics n = row_count;
  copied := copied + n;

  insert into backup.snapshots (taken_at, reason, table_name, row_data)
  select snapshot_time, take_snapshot.reason, 'visits', to_jsonb(v)
  from public.visits v;
  get diagnostics n = row_count;
  copied := copied + n;

  return copied;
end;
$$;

-- Deletes snapshots older than 30 days. Returns the number of rows deleted.
create or replace function backup.cleanup()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted integer;
begin
  delete from backup.snapshots where taken_at < now() - interval '30 days';
  get diagnostics deleted = row_count;
  return deleted;
end;
$$;

-- No access for the app. Functions are executable by PUBLIC by default, so revoke that too.
revoke all on schema backup from public, anon, authenticated;
revoke all on all tables in schema backup from public, anon, authenticated;
revoke all on all sequences in schema backup from public, anon, authenticated;
revoke all on all functions in schema backup from public, anon, authenticated;
alter default privileges in schema backup revoke all on tables from public, anon, authenticated;
alter default privileges in schema backup revoke all on sequences from public, anon, authenticated;
alter default privileges in schema backup revoke all on functions from public, anon, authenticated;

-- Nightly job at 01:00 UTC (03:00 Polish summer time, 02:00 winter time).
create extension if not exists pg_cron;

select cron.unschedule(jobid) from cron.job where jobname = 'backup-daglig';

select cron.schedule(
  'backup-daglig',
  '0 1 * * *',
  $$select backup.take_snapshot('daglig'); select backup.cleanup();$$
);

-- First snapshot right away, so there is a backup before the first night.
select backup.take_snapshot('oppsett av backup');
