# Sikkerhetskopi (backup)

Appen tar en kopi av alle klienter og besøk **hver natt kl. 01:00 UTC** (03:00 polsk sommertid, 02:00 vintertid).
Kopiene ligger i databasen, i schemaet `backup`, og slettes etter **30 dager**. Appen selv kan ikke lese eller endre dem.

All SQL under kjøres i **Supabase → SQL Editor → New query**. Bytt ut det som står i `STORE_BOKSTAVER`.

> Backupen ligger i samme database som dataene. Den beskytter mot feil i appen, feil i migreringer og
> ting som slettes ved et uhell – **ikke** mot at hele Supabase-prosjektet forsvinner. Derfor også
> månedlig CSV-eksport (punkt 3).

---

## 1. Sjekk at nattlig backup kjører

```sql
-- De siste kopiene: når, hvorfor og hvor mange rader
select taken_at, reason,
       count(*) filter (where table_name = 'clients') as klienter,
       count(*) filter (where table_name = 'visits')  as besok
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

Svaret er antall rader som ble kopiert (klienter + besøk). Manuelle kopier slettes også etter 30 dager.

## 3. Månedlig CSV-eksport

En gang i måneden, for en kopi utenfor Supabase:

1. Supabase → **Table Editor**.
2. Velg tabellen **clients** i listen til venstre.
3. Trykk **⋯** ved tabellnavnet (eller høyreklikk) → **Export data** → **Export table as CSV**.
4. Gjør det samme for tabellen **visits**.
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
  residence_city      = excluded.residence_city;

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
  created_at                = excluded.created_at;

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
  residence_city      = excluded.residence_city;

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
  created_at                = excluded.created_at;

commit;
```

**Godt å vite (gjelder punkt 5 og 6):**

- Klienter og besøk som ble **lagt til etter** `TIDSPUNKT`, blir liggende. Ingenting slettes.
- Endringer gjort etter `TIDSPUNKT` på klienter som gjenopprettes, overskrives. Kopien «før gjenoppretting …»
  tas først, så du kan gå tilbake til den med samme fremgangsmåte.
- Hvis noe feiler, stopper alt og ingenting endres. Kjør `rollback;` og si fra.
- Når nye kolonner legges til i `clients` eller `visits`, må listen etter `do update set` her oppdateres
  i samme PR som migreringen.

## 7. Plass og opprydding

```sql
-- Hvor mye plass kopiene bruker
select pg_size_pretty(pg_total_relation_size('backup.snapshots'));

-- Slett kopier eldre enn 30 dager nå (skjer ellers automatisk hver natt)
select backup.cleanup();
```
