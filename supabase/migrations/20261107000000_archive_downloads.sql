-- EX1 «Скачать архив»: when the doctor saved the HTML archive (one row per download) – shown as
-- «Последний архив: <дата>» at the bottom of the client list, red after 14 days.
-- Run once in Supabase SQL Editor after 20261106000000_visit_reminder.sql. Safe to run more than once.
-- Only adds one table with its policies. Nothing is changed or deleted.

select backup.take_snapshot('før migrering 20261107000000_archive_downloads.sql');

create table if not exists public.archive_downloads (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists archive_downloads_doctor_idx on public.archive_downloads (doctor_id, created_at desc);

-- Row Level Security: owner only, and only after TOTP (aal2) -----------------------------------
alter table public.archive_downloads enable row level security;

revoke all on public.archive_downloads from anon;
grant select, insert on public.archive_downloads to authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'archive_downloads' and policyname = 'archive_downloads: owner') then
    create policy "archive_downloads: owner" on public.archive_downloads for all to authenticated
      using (doctor_id = (select auth.uid())) with check (doctor_id = (select auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'archive_downloads' and policyname = 'archive_downloads: require mfa') then
    create policy "archive_downloads: require mfa" on public.archive_downloads as restrictive for all to authenticated
      using ((select auth.jwt() ->> 'aal') = 'aal2') with check ((select auth.jwt() ->> 'aal') = 'aal2');
  end if;
end;
$$;
