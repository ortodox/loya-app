-- EX1 (first part, without files): nightly export of all data to Google Drive. See docs/EXPORT.md.
-- Run once in Supabase SQL Editor after 20261101000000_face_scheme.sql. Safe to run more than once.
-- Only adds a table and two functions. Nothing is changed or deleted.
--
-- A Google Apps Script (scripts/google-drive-export.gs) calls public.export_all(secret) through the
-- Data API with the anon key. Only a bcrypt hash of the secret is stored here; the secret itself is
-- shown once by private.new_export_secret() and kept only in the script's Script Properties.

select backup.take_snapshot('før migrering 20261102000000_export.sql');

-- Supabase has pgcrypto in the extensions schema already; this is a no-op there.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- One row (id = 1): the hash of the current export secret.
create table if not exists private.export_settings (
  id int primary key default 1,
  secret_hash text,
  updated_at timestamptz
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'export_settings_single_row') then
    alter table private.export_settings add constraint export_settings_single_row check (id = 1);
  end if;
end;
$$;

revoke all on table private.export_settings from public, anon, authenticated;

-- A new random secret (64 hex characters). Stores only its hash and returns the secret once –
-- copy it into the Apps Script. Running it again replaces the old secret (if it has leaked).
create or replace function private.new_export_secret()
returns text
language plpgsql
set search_path = ''
as $$
declare
  secret text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  insert into private.export_settings (id, secret_hash, updated_at)
  values (1, extensions.crypt(secret, extensions.gen_salt('bf')), now())
  on conflict (id) do update set secret_hash = excluded.secret_hash, updated_at = excluded.updated_at;
  return secret;
end;
$$;

revoke all on function private.new_export_secret() from public, anon, authenticated;

-- Every table in public with a doctor_id column, as {"exported_at": …, "tables": {"clients": [...], …}}.
-- Only metadata and storage paths of photos and documents – never the file contents.
-- A wrong or missing secret gives the same error without details.
create or replace function public.export_all(p_secret text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  stored text;
  tbl text;
  tbl_rows jsonb;
  result jsonb := '{}'::jsonb;
begin
  select secret_hash into stored from private.export_settings where id = 1;
  if p_secret is null or stored is null or extensions.crypt(p_secret, stored) is distinct from stored then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  for tbl in
    select c.table_name
    from information_schema.columns c
    join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name
    where c.table_schema = 'public' and c.column_name = 'doctor_id' and t.table_type = 'BASE TABLE'
    order by c.table_name
  loop
    execute format('select coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb) from public.%I x', tbl) into tbl_rows;
    result := result || jsonb_build_object(tbl, tbl_rows);
  end loop;

  return jsonb_build_object('exported_at', now(), 'tables', result);
end;
$$;

-- Supabase grants new functions in public to anon and authenticated by default – only anon may call it.
revoke all on function public.export_all(text) from public, anon, authenticated;
grant execute on function public.export_all(text) to anon;
