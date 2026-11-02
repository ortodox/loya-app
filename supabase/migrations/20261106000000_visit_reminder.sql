-- N7: «Напомнить через» – in a visit the doctor sets when it is time for the next procedure
-- (2 or 3 weeks, 1, 3, 4 or 6 months, or her own date). From that day the client is shown with
-- «⏰ Пора» in the app until she taps «Готово». Only in the app – nothing goes to the phone calendar.
-- Run once in Supabase SQL Editor after 20261105000000_main_photo.sql. Safe to run more than once.
-- Only adds two nullable columns and an index. Nothing is changed or deleted.

select backup.take_snapshot('før migrering 20261106000000_visit_reminder.sql');

-- null = no reminder.
alter table public.visits add column if not exists remind_on date;
-- null = not done yet; a time = «Готово» was tapped then.
alter table public.visits add column if not exists reminder_done_at timestamptz;

create index if not exists visits_reminder_idx on public.visits (doctor_id, remind_on)
  where remind_on is not null and reminder_done_at is null;
