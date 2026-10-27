# Sikkerhetskopi (backup)

Appen tar en kopi av alle klienter og besøk **hver natt kl. 01:00 UTC** (03:00 polsk sommertid, 02:00 vintertid).
Kopiene ligger i databasen, i schemaet `backup`. Appen selv kan ikke lese eller endre dem.

Hvor lenge kopiene beholdes:

| Kopi | Beholdes |
|---|---|
| Nattlige kopier (`daglig`) | 30 dager |
| Alle andre: manuelle, før migreringer, før gjenoppretting | 90 dager |

All SQL under kjøres i **Supabase → SQL Editor → New query**. Bytt ut det som står i `STORE_BOKSTAVER`.

> Backupen ligger i samme database som dataene. Den beskytter mot feil i appen, feil i migreringer og
> ting som slettes ved et uhell – **ikke** mot at hele Supabase-prosjektet forsvinner. Derfor også
> månedlig CSV-eksport (punkt 3).

---

## 1. Sjekk at nattlig backup kjører

```sql
-- De siste kopiene: når, hvorfor og hvor mange rader
select taken_at, reason,
       count(*) filter (where table_name = 'clients')         as klienter,
       count(*) filter (where table_name = 'visits')          as besok,
       count(*) filter (where table_name = 'visit_photos')    as bilder,
       count(*) filter (where table_name = 'treatment_courses') as kurer,
       count(*) filter (where table_name = 'client_documents') as dokumenter,
       count(*) filter (where table_name = 'procedure_types') as typer,
       count(*) filter (where table_name = 'preparations')    as preparater
from backup.snapshots
group by taken_at, reason
order by taken_at desc
limit 10;
```

Du skal se én rad med `daglig` for hver natt. Antall klienter skal stemme med det som er i appen.

```sql
-- De siste kjøringene av nattjobben (status skal være «succeeded»)
select start_time, status, return_message
from cron.job_run_details
where jobid = (select jobid from cron.job where jobname = 'backup-daglig')
order by start_time desc
limit 5;
```

Hvis det ikke finnes noen rad med `daglig` fra i natt, eller status er `failed`: ta en manuell backup (punkt 2)
og si fra.

## 2. Ta en manuell backup

Gjør dette før du endrer noe stort, for eksempel før en ny migrering:

```sql
select backup.take_snapshot('manuell');
```

Svaret er antall rader som ble kopiert (klienter + besøk). Manuelle kopier beholdes i 90 dager.

## 3. Månedlig CSV-eksport

En gang i måneden, for en kopi utenfor Supabase:

1. Supabase → **Table Editor**.
2. Velg tabellen **clients** i listen til venstre.
3. Trykk **⋯** ved tabellnavnet (eller høyreklikk) → **Export data** → **Export table as CSV**.
4. Gjør det samme for tabellene **visits**, **procedure_types**, **preparations**, **zones** og
   **procedure_type_zones** (katalogen).
5. Gi filene navn med dato, f.eks. `clients_2026-11-01.csv` og `visits_2026-11-01.csv`.

**Viktig:** filene inneholder helseopplysninger. Lagre dem kryptert (f.eks. kryptert disk eller
passordbeskyttet arkiv), aldri i e-post, chat eller en vanlig delt mappe. Slett gamle eksporter du ikke trenger.

## 4. Se hvordan en klient så ut på et gitt tidspunkt

**a) Finn klientens id**

```sql
-- Klient som finnes nå
select id, full_name from public.clients where full_name ilike '%NAVN%';

-- Klient som er slettet: søk i kopiene
select distinct row_data ->> 'id' as id, row_data ->> 'full_name' as navn
from backup.snapshots
where table_name = 'clients' and row_data ->> 'full_name' ilike '%NAVN%';
```

**b) Se hvilke kopier som finnes for klienten**

```sql
select taken_at, reason
from backup.snapshots
where table_name = 'clients' and row_data ->> 'id' = 'KLIENT_ID'
order by taken_at desc;
```

**c) Se klienten slik den var**

`TIDSPUNKT` skrives som `'2026-10-23 02:00+02'` (dato, klokkeslett, tidssone). Du får siste kopi før dette tidspunktet.

```sql
select taken_at, jsonb_pretty(row_data) as klient
from backup.snapshots
where table_name = 'clients'
  and row_data ->> 'id' = 'KLIENT_ID'
  and taken_at <= 'TIDSPUNKT'
order by taken_at desc
limit 1;

-- Besøkene til klienten i samme kopi
select jsonb_pretty(s.row_data) as besok
from backup.snapshots s
where s.table_name = 'visits'
  and s.row_data ->> 'client_id' = 'KLIENT_ID'
  and s.taken_at = (select max(taken_at) from backup.snapshots where taken_at <= 'TIDSPUNKT');
```

## 5. Gjenopprett én klient

Setter klienten og besøkene hennes tilbake til siste kopi før `TIDSPUNKT`. Virker også om klienten er slettet.
Det tas først en kopi av dagens tilstand, slik at du kan angre.

```sql
begin;

select backup.take_snapshot('før gjenoppretting av én klient');

with valgt as (
  select max(taken_at) as t from backup.snapshots where taken_at <= 'TIDSPUNKT'
)
insert into public.clients
select (jsonb_populate_record(null::public.clients, s.row_data)).*
from backup.snapshots s, valgt
where s.taken_at = valgt.t
  and s.table_name = 'clients'
  and s.row_data ->> 'id' = 'KLIENT_ID'
on conflict (id) do update set
  doctor_id           = excluded.doctor_id,
  full_name           = excluded.full_name,
  card_date           = excluded.card_date,
  phone               = excluded.phone,
  language            = excluded.language,
  anamnesis           = excluded.anamnesis,
  notes               = excluded.notes,
  created_at          = excluded.created_at,
  age_at_registration = excluded.age_at_registration,
  birth_date          = excluded.birth_date,
  email               = excluded.email,
  residence_country   = excluded.residence_country,
  residence_city      = excluded.residence_city,
  procedure_plan      = excluded.procedure_plan,
  anamnesis_confirmed_at = excluded.anamnesis_confirmed_at,
  direction           = excluded.direction,
  care_text           = excluded.care_text,
  care_updated_at     = excluded.care_updated_at;

with valgt as (
  select max(taken_at) as t from backup.snapshots where taken_at <= 'TIDSPUNKT'
)
insert into public.visits
select (jsonb_populate_record(null::public.visits, s.row_data)).*
from backup.snapshots s, valgt
where s.taken_at = valgt.t
  and s.table_name = 'visits'
  and s.row_data ->> 'client_id' = 'KLIENT_ID'
on conflict (id) do update set
  visit_date                = excluded.visit_date,
  home_care_recommendations = excluded.home_care_recommendations,
  procedure_plan            = excluded.procedure_plan,
  notes                     = excluded.notes,
  recommendations           = excluded.recommendations,
  recommendations_lang      = excluded.recommendations_lang,
  recommendations_edited    = excluded.recommendations_edited,
  created_at                = excluded.created_at;

-- Preparations in the visits (R1)
with valgt as (
  select max(taken_at) as t from backup.snapshots where taken_at <= 'TIDSPUNKT'
)
insert into public.visit_items
select (jsonb_populate_record(null::public.visit_items, s.row_data)).*
from backup.snapshots s, valgt
where s.taken_at = valgt.t
  and s.table_name = 'visit_items'
  and s.row_data ->> 'visit_id' in (
    select v.row_data ->> 'id' from backup.snapshots v
    where v.taken_at = valgt.t and v.table_name = 'visits' and v.row_data ->> 'client_id' = 'KLIENT_ID'
  )
on conflict (id) do update set
  preparation_id    = excluded.preparation_id,
  preparation_name  = excluded.preparation_name,
  procedure_type_id = excluded.procedure_type_id,
  quantity          = excluded.quantity,
  sort_order        = excluded.sort_order;

-- Photo rows – only where the image file still exists in Storage
with valgt as (
  select max(taken_at) as t from backup.snapshots where taken_at <= 'TIDSPUNKT'
)
insert into public.visit_photos
select (jsonb_populate_record(null::public.visit_photos, s.row_data)).*
from backup.snapshots s, valgt
where s.taken_at = valgt.t
  and s.table_name = 'visit_photos'
  and s.row_data ->> 'visit_id' in (
    select v.row_data ->> 'id' from backup.snapshots v
    where v.taken_at = valgt.t and v.table_name = 'visits' and v.row_data ->> 'client_id' = 'KLIENT_ID'
  )
  and exists (select 1 from storage.objects o
              where o.bucket_id = 'visit-photos' and o.name = s.row_data ->> 'storage_path')
on conflict (id) do nothing;

-- Treatment courses (LE1)
with valgt as (
  select max(taken_at) as t from backup.snapshots where taken_at <= 'TIDSPUNKT'
)
insert into public.treatment_courses
select (jsonb_populate_record(null::public.treatment_courses, s.row_data)).*
from backup.snapshots s, valgt
where s.taken_at = valgt.t
  and s.table_name = 'treatment_courses'
  and s.row_data ->> 'client_id' = 'KLIENT_ID'
on conflict (id) do update set
  diagnosis          = excluded.diagnosis,
  prescription       = excluded.prescription,
  start_date         = excluded.start_date,
  end_date           = excluded.end_date,
  lab_interval_value = excluded.lab_interval_value,
  lab_interval_unit  = excluded.lab_interval_unit,
  last_lab_date      = excluded.last_lab_date,
  status             = excluded.status,
  completed_at       = excluded.completed_at,
  created_at         = excluded.created_at;

-- Prescription photo rows (LE3) – only where the image file still exists in Storage
with valgt as (
  select max(taken_at) as t from backup.snapshots where taken_at <= 'TIDSPUNKT'
)
insert into public.course_photos
select (jsonb_populate_record(null::public.course_photos, s.row_data)).*
from backup.snapshots s, valgt
where s.taken_at = valgt.t
  and s.table_name = 'course_photos'
  and s.row_data ->> 'course_id' in (
    select k.row_data ->> 'id' from backup.snapshots k
    where k.taken_at = valgt.t and k.table_name = 'treatment_courses' and k.row_data ->> 'client_id' = 'KLIENT_ID'
  )
  and exists (select 1 from storage.objects o
              where o.bucket_id = 'visit-photos' and o.name = s.row_data ->> 'storage_path')
on conflict (id) do nothing;

-- Treatment courses (LE1)
with valgt as (
  select max(taken_at) as t from backup.snapshots where taken_at <= 'TIDSPUNKT'
)
insert into public.treatment_courses
select (jsonb_populate_record(null::public.treatment_courses, s.row_data)).*
from backup.snapshots s, valgt
where s.taken_at = valgt.t
  and s.table_name = 'treatment_courses'
on conflict (id) do update set
  diagnosis          = excluded.diagnosis,
  prescription       = excluded.prescription,
  start_date         = excluded.start_date,
  end_date           = excluded.end_date,
  lab_interval_value = excluded.lab_interval_value,
  lab_interval_unit  = excluded.lab_interval_unit,
  last_lab_date      = excluded.last_lab_date,
  status             = excluded.status,
  completed_at       = excluded.completed_at,
  created_at         = excluded.created_at;

-- Prescription photo rows (LE3) – only where the image file still exists in Storage
with valgt as (
  select max(taken_at) as t from backup.snapshots where taken_at <= 'TIDSPUNKT'
)
insert into public.course_photos
select (jsonb_populate_record(null::public.course_photos, s.row_data)).*
from backup.snapshots s, valgt
where s.taken_at = valgt.t
  and s.table_name = 'course_photos'
  and exists (select 1 from storage.objects o
              where o.bucket_id = 'visit-photos' and o.name = s.row_data ->> 'storage_path')
on conflict (id) do nothing;

-- Care photos (UH2) – only where the image file still exists in Storage
with valgt as (
  select max(taken_at) as t from backup.snapshots where taken_at <= 'TIDSPUNKT'
)
insert into public.client_care_photos
select (jsonb_populate_record(null::public.client_care_photos, s.row_data)).*
from backup.snapshots s, valgt
where s.taken_at = valgt.t
  and s.table_name = 'client_care_photos'
  and s.row_data ->> 'client_id' = 'KLIENT_ID'
  and exists (select 1 from storage.objects o
              where o.bucket_id = 'visit-photos' and o.name = s.row_data ->> 'storage_path')
on conflict (id) do nothing;

-- Documents and lab results (DK1, LE8) – only where the file still exists in Storage
with valgt as (
  select max(taken_at) as t from backup.snapshots where taken_at <= 'TIDSPUNKT'
)
insert into public.client_documents
select (jsonb_populate_record(null::public.client_documents, s.row_data)).*
from backup.snapshots s, valgt
where s.taken_at = valgt.t
  and s.table_name = 'client_documents'
  and s.row_data ->> 'client_id' = 'KLIENT_ID'
  and exists (select 1 from storage.objects o
              where o.bucket_id = 'client-documents' and o.name = s.row_data ->> 'storage_path')
on conflict (id) do update set
  title         = excluded.title,
  document_date = excluded.document_date,
  course_id     = excluded.course_id;

commit;
```

Svaret skal være «Success». Sjekk deretter klienten i appen, eller med spørringen i punkt 4c.
Finnes det ingen kopi før `TIDSPUNKT`, endres ingenting.

## 6. Gjenopprett alle klienter

Samme som punkt 5, men for alle. Bruk dette bare hvis mye har gått galt.

```sql
begin;

select backup.take_snapshot('før gjenoppretting av alle');

with valgt as (
  select max(taken_at) as t from backup.snapshots where taken_at <= 'TIDSPUNKT'
)
insert into public.clients
select (jsonb_populate_record(null::public.clients, s.row_data)).*
from backup.snapshots s, valgt
where s.taken_at = valgt.t
  and s.table_name = 'clients'
on conflict (id) do update set
  doctor_id           = excluded.doctor_id,
  full_name           = excluded.full_name,
  card_date           = excluded.card_date,
  phone               = excluded.phone,
  language            = excluded.language,
  anamnesis           = excluded.anamnesis,
  notes               = excluded.notes,
  created_at          = excluded.created_at,
  age_at_registration = excluded.age_at_registration,
  birth_date          = excluded.birth_date,
  email               = excluded.email,
  residence_country   = excluded.residence_country,
  residence_city      = excluded.residence_city,
  procedure_plan      = excluded.procedure_plan,
  anamnesis_confirmed_at = excluded.anamnesis_confirmed_at,
  direction           = excluded.direction,
  care_text           = excluded.care_text,
  care_updated_at     = excluded.care_updated_at;

with valgt as (
  select max(taken_at) as t from backup.snapshots where taken_at <= 'TIDSPUNKT'
)
insert into public.visits
select (jsonb_populate_record(null::public.visits, s.row_data)).*
from backup.snapshots s, valgt
where s.taken_at = valgt.t
  and s.table_name = 'visits'
on conflict (id) do update set
  visit_date                = excluded.visit_date,
  home_care_recommendations = excluded.home_care_recommendations,
  procedure_plan            = excluded.procedure_plan,
  notes                     = excluded.notes,
  recommendations           = excluded.recommendations,
  recommendations_lang      = excluded.recommendations_lang,
  recommendations_edited    = excluded.recommendations_edited,
  created_at                = excluded.created_at;

-- Preparations in the visits (R1)
with valgt as (
  select max(taken_at) as t from backup.snapshots where taken_at <= 'TIDSPUNKT'
)
insert into public.visit_items
select (jsonb_populate_record(null::public.visit_items, s.row_data)).*
from backup.snapshots s, valgt
where s.taken_at = valgt.t
  and s.table_name = 'visit_items'
on conflict (id) do update set
  preparation_id    = excluded.preparation_id,
  preparation_name  = excluded.preparation_name,
  procedure_type_id = excluded.procedure_type_id,
  quantity          = excluded.quantity,
  sort_order        = excluded.sort_order;

-- Photo rows – only where the image file still exists in Storage
with valgt as (
  select max(taken_at) as t from backup.snapshots where taken_at <= 'TIDSPUNKT'
)
insert into public.visit_photos
select (jsonb_populate_record(null::public.visit_photos, s.row_data)).*
from backup.snapshots s, valgt
where s.taken_at = valgt.t
  and s.table_name = 'visit_photos'
  and exists (select 1 from storage.objects o
              where o.bucket_id = 'visit-photos' and o.name = s.row_data ->> 'storage_path')
on conflict (id) do nothing;

-- Care photos (UH2) – only where the image file still exists in Storage
with valgt as (
  select max(taken_at) as t from backup.snapshots where taken_at <= 'TIDSPUNKT'
)
insert into public.client_care_photos
select (jsonb_populate_record(null::public.client_care_photos, s.row_data)).*
from backup.snapshots s, valgt
where s.taken_at = valgt.t
  and s.table_name = 'client_care_photos'
  and exists (select 1 from storage.objects o
              where o.bucket_id = 'visit-photos' and o.name = s.row_data ->> 'storage_path')
on conflict (id) do nothing;

-- Documents and lab results (DK1, LE8) – only where the file still exists in Storage
with valgt as (
  select max(taken_at) as t from backup.snapshots where taken_at <= 'TIDSPUNKT'
)
insert into public.client_documents
select (jsonb_populate_record(null::public.client_documents, s.row_data)).*
from backup.snapshots s, valgt
where s.taken_at = valgt.t
  and s.table_name = 'client_documents'
  and exists (select 1 from storage.objects o
              where o.bucket_id = 'client-documents' and o.name = s.row_data ->> 'storage_path')
on conflict (id) do update set
  title         = excluded.title,
  document_date = excluded.document_date,
  course_id     = excluded.course_id;

commit;
```

**Godt å vite (gjelder punkt 5 og 6):**

- Klienter og besøk som ble **lagt til etter** `TIDSPUNKT`, blir liggende. Ingenting slettes.
- Endringer gjort etter `TIDSPUNKT` på klienter som gjenopprettes, overskrives. Kopien «før gjenoppretting …»
  tas først, så du kan gå tilbake til den med samme fremgangsmåte.
- Hvis noe feiler, stopper alt og ingenting endres. Kjør `rollback;` og si fra.
- Når nye kolonner legges til i `clients`, `visits`, `visit_items` eller `treatment_courses`, må listen etter `do update set` her oppdateres
  i samme PR som migreringen.
- **Bilder og dokumenter:** rader for etiketter, resepter, «Уход» og dokumenter legges bare tilbake når filen fortsatt finnes i Storage (se punkt 8).

## 6b. Gjenopprett katalogen

Kopiene inneholder også katalogen: behandlingstyper, soner, sonene per type og preparater.
SQL-en setter dem tilbake til siste kopi før `TIDSPUNKT`. Klienter og besøk røres ikke.

```sql
begin;

select backup.take_snapshot('før gjenoppretting av katalogen');

with valgt as (
  select max(taken_at) as t from backup.snapshots where taken_at <= 'TIDSPUNKT'
)
insert into public.zones
select (jsonb_populate_record(null::public.zones, s.row_data)).*
from backup.snapshots s, valgt
where s.taken_at = valgt.t and s.table_name = 'zones'
on conflict (id) do update set
  code = excluded.code, name = excluded.name, zone_group = excluded.zone_group,
  sort_order = excluded.sort_order, active = excluded.active;

with valgt as (
  select max(taken_at) as t from backup.snapshots where taken_at <= 'TIDSPUNKT'
)
insert into public.procedure_types
select (jsonb_populate_record(null::public.procedure_types, s.row_data)).*
from backup.snapshots s, valgt
where s.taken_at = valgt.t and s.table_name = 'procedure_types'
on conflict (id) do update set
  code = excluded.code, name = excluded.name, sort_order = excluded.sort_order,
  dose_text = excluded.dose_text, dose_unit = excluded.dose_unit,
  course_min = excluded.course_min, course_max = excluded.course_max,
  interval_min = excluded.interval_min, interval_max = excluded.interval_max,
  interval_unit = excluded.interval_unit,
  maintenance_min = excluded.maintenance_min, maintenance_max = excluded.maintenance_max,
  maintenance_unit = excluded.maintenance_unit, maintenance_as_needed = excluded.maintenance_as_needed,
  control_after_days = excluded.control_after_days,
  advice = excluded.advice, advice_review = excluded.advice_review, active = excluded.active;

with valgt as (
  select max(taken_at) as t from backup.snapshots where taken_at <= 'TIDSPUNKT'
)
insert into public.procedure_type_zones
select (jsonb_populate_record(null::public.procedure_type_zones, s.row_data)).*
from backup.snapshots s, valgt
where s.taken_at = valgt.t and s.table_name = 'procedure_type_zones'
on conflict do nothing;

with valgt as (
  select max(taken_at) as t from backup.snapshots where taken_at <= 'TIDSPUNKT'
)
insert into public.preparations
select (jsonb_populate_record(null::public.preparations, s.row_data)).*
from backup.snapshots s, valgt
where s.taken_at = valgt.t and s.table_name = 'preparations'
on conflict (id) do update set
  procedure_type_id = excluded.procedure_type_id, name = excluded.name,
  manufacturer = excluded.manufacturer, favorite = excluded.favorite,
  dose_text = excluded.dose_text, dose_unit = excluded.dose_unit,
  course_min = excluded.course_min, course_max = excluded.course_max,
  interval_min = excluded.interval_min, interval_max = excluded.interval_max,
  interval_unit = excluded.interval_unit,
  maintenance_min = excluded.maintenance_min, maintenance_max = excluded.maintenance_max,
  maintenance_unit = excluded.maintenance_unit, maintenance_as_needed = excluded.maintenance_as_needed,
  control_after_days = excluded.control_after_days,
  advice = excluded.advice, advice_review = excluded.advice_review, active = excluded.active;

commit;
```

- Typer, soner og preparater som ble **lagt til etter** `TIDSPUNKT`, blir liggende. Det samme gjelder soner som ble
  lagt til en type.
- Når nye kolonner legges til i katalogtabellene, må listene etter `do update set` her oppdateres i samme PR.

## 7. Plass og opprydding

```sql
-- Hvor mye plass kopiene bruker
select pg_size_pretty(pg_total_relation_size('backup.snapshots'));

-- Rydd nå: sletter «daglig» eldre enn 30 dager og andre kopier eldre enn 90 dager
-- (skjer ellers automatisk hver natt)
select backup.cleanup();
```

## 8. Bilder og dokumenter i Storage

Bildene fra besøkene («Фото наклейки») ligger i Supabase Storage, i den private bøtten **visit-photos**,
under `<lege-id>/<besøk-id>/<fil>.jpg`. **Bildefilene er ikke med i kopiene i databasen** – kopiene inneholder
bare radene i `visit_photos` (hvilket besøk og hvilken fil). Sletter appen et bilde, slettes filen med en gang.

**Bilder av resepter** i behandlingskurer (LE3) ligger i samme bøtte, under `<lege-id>/courses/<kur-id>/<fil>.jpg`,
med radene i `course_photos`. De er heller ikke med i kopiene – last dem ned på samme måte (mappen **courses**).

**Bilder i «Уход»** (UH2) ligger også i **visit-photos**, under `<lege-id>/care/<klient-id>/<fil>.jpg`, med radene i
`client_care_photos` (mappen **care**).

**Dokumenter og analyser** (DK1) ligger i en egen privat bøtte, **client-documents**, under
`<lege-id>/<klient-id>/<fil>` (bilder og PDF, maks 20 MB per fil), med radene i `client_documents` (tittel, dato,
eventuell kur). **Filene er ikke med i kopiene i databasen.** Last dem ned på samme måte: Supabase → **Storage** →
**client-documents** → mappen med din bruker-id → mappen for klienten → merk filene → **Download**.

**Last ned bildene manuelt** (f.eks. sammen med den månedlige CSV-eksporten):

1. Supabase → **Storage** → bøtten **visit-photos**.
2. Åpne mappen med din bruker-id, deretter mappen for besøket.
3. Merk bildene → **Download**. (Hele mapper kan ikke lastes ned på én gang i dashbordet – ta det besøk for besøk,
   eller be om et lite skript for å laste ned alt.)
4. Lagre dem kryptert, som CSV-filene (punkt 3).

```sql
-- Hvor mange bilder og hvor mye plass
select count(*) as bilder, pg_size_pretty(sum((metadata ->> 'size')::bigint)) as storrelse
from storage.objects where bucket_id = 'visit-photos';

-- Hvilket besøk og hvilken klient et bilde hører til
select c.full_name, v.visit_date, p.storage_path
from public.visit_photos p
join public.visits v on v.id = p.visit_id
join public.clients c on c.id = v.client_id
order by v.visit_date desc;

-- Dokumenter: hvilken klient, tittel, dato og fil
select c.full_name, d.document_date, d.title, d.mime_type, d.storage_path
from public.client_documents d
join public.clients c on c.id = d.client_id
order by d.document_date desc;

-- Hvor mye plass dokumentene tar
select count(*) as filer, pg_size_pretty(sum((metadata ->> 'size')::bigint)) as storrelse
from storage.objects where bucket_id = 'client-documents';

-- Bilder av resepter: hvilken kur og hvilken klient
select c.full_name, k.diagnosis, k.start_date, p.storage_path
from public.course_photos p
join public.treatment_courses k on k.id = p.course_id
join public.clients c on c.id = k.client_id
order by p.created_at desc;
```

