# CLAUDE.md – Loya-app

## Hva dette er

En mobilapp (PWA) for en selvstendig næringsdrivende lege innen estetisk medisin i **Polen** («Loya»).
Den erstatter to ting hun bruker i dag:

1. **Apple Notater** – ett notat «Карта клиента» per klient med fast mal (anamnese, hud, aldring, tidligere behandlinger) + besøk som skrives videre nederst i samme notat.
2. **Papirhefte hos klienten** – én side per behandling: dato, preparat, dose, frihåndstegning av injeksjonspunkter på en ansiktsmal.

Appen er **ikke** lovpålagt medisinsk journal (EDM). Den er et verktøy for oppfølging, ettervern og kommunikasjon med klienten.

**Kilder i repoet:**
- `roadmap_ru.md` – alle MVP-er og brukerhistorier (kilden til sannhet for omfang)
- `brukerhistorier_loya_ru.md` – samme historier, formatert for Loya
- `preparaty_ru.md` – katalogen: behandlingstyper, soner, standardverdier, råd etter behandling og ca. 95 preparater (godkjent av Loya 26.10.2026)

## Nåværende oppgave: MVP 1b – digitalt hefte

**Rekkefølge** (vedtatt 26.10.2026, se «Порядок работы» i `roadmap_ru.md`). MVP-nummereringen beholdes; bare rekkefølgen endres – 1c kommer før 1b-3 og 1b-4:

1. **1b-1 Каталог** ✅ – B1, P1, P2, P5, S2
2. **1b-2 Новый визит** ✅ (godkjent av Loya – et besøk tar ca. ett minutt) – R1, DO1, LOT1, R2, P5, H1, PP1, P9, AL1, P10, PO1, DR1, AV1. Rådene er for klienten: hos legen **sammenfoldet til én linje**; AL1-varselet **alltid åpent**, og nevner ord fra allergifeltet som står i rådene (`adviceConflicts`). P10 = standarddose som hjelpetekst. PO1 = preparater klienten har fått før øverst. DR1 = utkast. AV1 = «Добавить визит» etter ny klient.
3. **1b-2b Быстрее каждый день** ✅ (venter på Loyas kontroll) – RV1 (gjenta forrige fullførte besøk: preparater + mengde, dato i dag, råd på nytt), VP2 (besøk etter i dag = «Запланирован», gruppe «Предстоящие визиты», «Запись: 31.10» i listen), KT1 (ring, WhatsApp, Telegram, Viber), PR7 (søk på telefonnummer), AN3 delvis («Анамнез без изменений ✓» → `clients.anamnesis_confirmed_at`), ny rekkefølge i klientkortet
4. **1c Лечение, уход и документы** – LE1–LE6, LE8, LE9, UH1, UH2, DM1, DK1, DK3, DK5. **1c-1 ✅** (testet av Loya 27.10.2026): DM1, LE1–LE6, LE9. **1c-2 ✅**: UH1, UH2, LE8, DK1, DK3, DK5. **MVP 1c ✅ ferdig – godkjent av Loya 28.10.2026.** DM1: retning «Косметология» / «Дерматология» / begge per klient, filter i listen (to piller, trykk igjen fjerner valget, ingen valgt = alle); settes automatisk til «Дерматология» når en kur opprettes. Eldre klienter uten retning: «Направление не указано» med to knapper øverst i kortet (ett trykk, `setMissingDirection`), og de teller som «Косметология» i filteret til retningen er satt (`matchesFilter`). Diagnose kun i kurset (ikke eget felt i kortet); aktivt kurs øverst i kortet; resepter skrives i et annet system (kun foto); ingen legemiddelliste
5. **1b-3 Схема лица** ✅ (venter på Loyas kontroll) – Z5. Realistisk ansikt forfra med hals (Loyas ønske 28.10.2026; `public/templates/face-front.webp` fra `design/face_cosmetics.PNG`, 2:3), mal-ID `front-photo-v1` for nye skjemaer. Gamle skjemaer med `front` vises fortsatt på den strektegnede SVG-malen (kun visning), så punktene ikke flyttes. Tegning med fingeren (kort trykk = punkt, dra = linje, 3 farger, 2 tykkelser, «Отменить», «Очистить»), lagret som streker i `visits.face_scheme`. Regler i `src/logic/rules/face-scheme.ts` (`templateFor`, `templateSpec`, `showsFaceScheme`). **Kun kosmetologi** (se Design). Klienten ser ikke skjemaet.
5b. **Фото клиента** ✅ (venter på Loyas kontroll, Loyas ønske 30.10.2026) – FK1–FK4. Bilder klienten sender (1–3 om gangen fra «Фото»), tidslinje etter **opptaksdato** (EXIF `DateTimeOriginal` leses før komprimering; ellers i dag; kan endres i skjemaet), ingen vinkel, intet samtykke. Kosmetologi: seksjonen «Фото клиента» rett etter «Визиты»; kur: «Фото клиента» inne i den aktive kuren i «Лечение» (hvor «+ Фото» trykkes avgjør `course_id`). «Удалить» med bekreftelse (FK4). **FK6** (Loyas ønske 02.11.2026): «★ Сделать главным» / «Убрать из главного» under hvert bilde i «Фото клиента» (ikke i kurer), ingen bekreftelse; uten valg = initialer. FK5 🔗 (klienten ser bildene) kommer med 1b-4. Regler i `src/logic/rules/client-photos.ts` (`exifDate`, `suggestedPhotoDate`, `photoTimeline`, `splitClientPhotos`, `showsClientPhotos`, `mainPhoto`).
5c. **Удаление клиента** ✅ (venter på Loyas kontroll, 31.10.2026) – PR6. Rød «Удалить клиента» nederst i kortet, bekreftelse «Удалить» / «Отмена» med ekstra advarsel ved planlagte besøk eller aktiv kur (`deleteWarnings`). Klienten får `deleted_at` og forsvinner fra liste, søk, kort og eksportens regneark; «Удалённые клиенты (N)» under listen → `/clients/deleted` med «Восстановить». **Etter 30 dager slettes klienten for godt** (godkjent 31.10.2026): `purgeExpiredClients` kjøres når klientlisten åpnes – først filene via Storage-API-et, så raden (`on delete cascade` tar besøk, kurer, bilder og dokumenter). Regler i `src/logic/rules/trash.ts`.
5d. **Расход** (RS1) ✅ (venter på Loyas kontroll) – «Препараты» → bryter «Каталог | Склад | Расход» (`CatalogSwitch`), `/catalog?view=usage&month=ÅÅÅÅ-MM` (`ConsumptionView`): måned «‹ Ноябрь 2026 ›», brukt (gjennomførte besøk) og for inneværende måned «→ ~» prognose for neste (planlagte besøk – deres preparater, ellers klientens siste besøk – og åpne «⏰ Пора»; en klient med planlagt besøk telles ikke to ganger). Botoks (BT-01) i ЕД lest fra fritekst (`botoxUnits`: «20+15» = 35; uleselig → klientens siste leselige mengde i prognosen, ellers «N записей без числа»), andre i шт (`pieces`: 1 per preparat eller tallet). Gruppert per type med korte navn. Ingen klientnavn. Regler i `src/logic/rules/consumption.ts`, data i `consumption-supabase.ts` (besøk for aktive klienter, `clients!inner`).
5e. **Склад** (SK1) ✅ (venter på Loyas kontroll, 06.11.2026) – `/catalog?view=stock` (`StockView`): bare preparater Loya velger («+ На склад» → `/catalog/stock/new`), botoks (BT-01) i hetteglass med egne størrelser per preparat (50/100/200/300/500 eller egen), andre i шт. «+ Поступление» (antall, eller ett allerede åpnet glass med åpningsdato og rest; LOT/utløp valgfritt), «Списать остаток», «Исправить остаток». **Beholdningen regnes alltid ut på nytt** (`simulateStock`): innkjøp + gjennomførte besøk fra `started_on` + justeringer – endret/slettet besøk slår rett inn. Trekk fra eldste åpne glass, neste åpnes selv; besøket husker ikke glasset. «В наличии» / «После записей ~» (planlagte besøk). I besøksskjemaet under «Количество»: «В наличии», varsel «На складе только N» (lagring tillatt) og «Не указано – со склада не списано» for botoks uten tall. **SK3 «История ▾»** (07.11.2026) under hvert preparat, lukket som standard: alle hendelser med saldo etter hver linje (`StockState.history`, nyeste øverst, 10 om gangen, `StockHistory`). **SK3 ✏️:** besøkslinjer viser teksten slik den ble skrevet («10 штук», «лоб 20» → не списано). **RS1 ✏️:** `pieces`/`botoxUnits` leser «штук», «шприца», «единиц», «ед.», «од», «szt.» (bruk `[а-яё]`, ikke `\w`, for kyrillisk); besøksskjemaet viser «Прочитано как N шт/ЕД» når mengden er mer enn et tall (`needsReadingHint`). **SK4 endringslogg** (migrering) er neste. Ingen «Заканчивается», ingen klientnavn, ikke i arkivet. Regler i `src/logic/rules/stock.ts`, brukstilfeller i `src/logic/usecases/stock.ts`.
5f. **Наблюдение за прогнозом** – Loya setter «Напомнить через» selv og ser i en måned (til ca. 06.12.2026) om «~ Ожидается» stemmer; automatisk påminnelse per type (N8) er en mulig senere forbedring.
6. **1b-4 Страница клиента** ← *neste* – HE1, E2, E3, E4. Én app; hemmelig lenke per besøk (`/p/<kode>`), uten innlogging, kan trekkes tilbake, ikke indekserbar (`noindex`). Klienten ser dato, preparater, foto av klistremerke og råd – ikke mengde eller notater. *Eget domene anbefales før 1b-4.*
7. **MVP 2 …** videre etter nummer

VS2 er fjernet (hjemmepleie er ikke lenger i besøket – erstattet av «Уход», UH1/UH2 i 1c). Katalogen i `preparaty_ru.md`.

**MVP 1b ferdig når:** Loya har registrert en behandling med ansiktsskisse og sendt siden til klienten, og den åpnes riktig på telefonen på klientens språk.

**Ikke bygg før det står for tur:** beregning av neste dato, kontrollbesøk og kurstrinn (MVP 2), påminnelser (MVP 2 og 4), strukturerte soner (MVP 6) og alt under «Позже». MVP 8 (klientkonto) og MVP 11 (hjemmepleie) er fjernet.

**MVP 1a er ferdig (✅):** innlogging, klientliste, hele «Карта клиента» og besøk. Kontrollpunktet «Заметки больше не нужны» venter på Loyas bekreftelse.

### Katalogprinsipp (`preparaty_ru.md`)

- **Råd, intervaller og kur defineres per BEHANDLINGSTYPE** (BT-01 … BT-10) og **arves av alle preparater** av den typen.
- **Et preparat kan overstyre** typens verdier (unntak), f.eks. «Миндальный пилинг 40%». Uten overstyring gjelder typens verdier.
- Felt merket «*заполнить*» i katalogen mangler data – Loya fyller dem ut i appen. Ikke dikt opp verdier.
- En registrert behandling lagrer råd og parametere slik de var på behandlingstidspunktet (P9).

## Teknologi

- **Next.js (App Router) + TypeScript + Tailwind CSS**
- **Supabase** (Postgres, Auth, senere Storage) – region **eu-central-1 (Frankfurt)**
- **Vercel** for deploy, funksjoner i region `fra1`
- **next-intl** for språk
- **Vitest** for tester
- PWA: manifest + ikon, slik at appen kan legges på hjemskjermen på iPhone

## Arkitektur – tre lag

```
src/
  app/              PRESENTASJON – sider og komponenter (tynt lag, ingen forretningsregler)
  logic/
    rules/          DOMENEREGLER – rene funksjoner uten I/O (f.eks. beregnAlder)
    usecases/       BRUKSTILFELLER – orkestrerer: tilgang, hente, regler, lagre
  data/
    repositories/   DATALAG – grensesnitt (clients.ts, visits.ts, catalog.ts) + Supabase-implementasjon (*-supabase.ts)
  config/
    kartaTemplate.ts  Malen for «Карта клиента» beskrevet som data
messages/           ru.json, uk.json, pl.json, en.json
supabase/migrations/  SQL-migreringer
```

Regler:
- Presentasjon kaller kun brukstilfeller. Ingen Supabase-kall direkte fra komponenter, unntatt auth-klient.
- Domeneregler er rene funksjoner og skal ha tester.
- **Tester navngis etter historie-ID**, f.eks. `describe("AG1: актуальный возраст", ...)`.

## Datamodell (MVP 1a)

- `clients` – id, `doctor_id` (= auth.uid()), `full_name` (påkrevd), `phone`, `email`, `residence_country` (ISO 3166-1 alpha-2, f.eks. `PL`), `residence_city`, `language`, `card_date` (første besøk = registreringsdato, brukes i AG1), `age_at_registration`, `birth_date` (valgfri), `anamnesis` (jsonb, flate feltnøkler fra `kartaTemplate.ts`: `{ choices: [...], text }`), `notes`, timestamps
- `clients.procedure_plan` – «План процедур» (PP1), i klientkortet (fra migrering `20261027000000_visit_items.sql`)
- `clients.anamnesis_confirmed_at` – dato for siste «Анамнез без изменений ✓» (AN3, migrering `20261029000000_anamnesis_confirmed.sql`)
- `clients.deleted_at` – timestamptz; `null` = aktiv klient, ellers i «Удалённые клиенты» (PR6, migrering `20261104000000_client_trash.sql`). `clients-supabase` filtrerer bort slettede klienter i `list`/`get`; papirkurven har eget repository (`trash.ts`).
- `clients.direction` – text[] med `cosmetology` / `dermatology` (DM1); `null` = ikke satt. Settes til «Дерматология» når en kur opprettes (`withDermatology`).
- `treatment_courses` – id, `doctor_id`, `client_id`, `diagnosis` (påkrevd), `prescription`, `start_date`, `end_date` (omtrentlig), `lab_interval_value` + `lab_interval_unit` (`days`/`weeks`/`months`, desimaler tillatt), `last_lab_date`, `status` (`active`/`completed`), `completed_at`, timestamps (LE1–LE6, LE9; migrering `20261030000000_treatment_courses.sql`). Regler i `src/logic/rules/courses.ts` (`courseProgress`, `nextLabDate`, `treatmentStatus`).
- `course_photos` – id, `doctor_id`, `course_id`, `storage_path`, `created_at` (LE3). Filene i samme private bøtte `visit-photos` under `<doctor_id>/courses/<course_id>/<fil>.jpg`; ikke med i snapshot.
- `clients.care_text`, `clients.care_updated_at` – «Уход» (UH1); «Обновлено» flyttes bare når tekst eller bilder endres (`careChanged`).
- `client_care_photos` – id, `doctor_id`, `client_id`, `storage_path`, `sort_order` (UH2). Filene i `visit-photos` under `<doctor_id>/care/<client_id>/<fil>.jpg`.
- `client_documents` – id, `doctor_id`, `client_id`, `course_id` (valgfri, LE8), `title`, `document_date`, `storage_path`, `mime_type` (bilder/PDF), `size_bytes` (≤ 20 MB) (DK1; migrering `20261031000000_care_documents.sql`). Filene i den private bøtten **`client-documents`** under `<doctor_id>/<client_id>/<fil>` (eier + aal2). Lastes opp **direkte fra telefonen** med en engangs signert lenke (`prepareDocumentUpload` → `uploadToSignedUrl` → `registerDocument`), fordi server actions har 4 MB grense. Ikke med i snapshot.
- **Planlagte besøk (VP2):** ingen egen kolonne – et besøk med dato etter i dag er en timeavtale (`isPlanned`). Klientlisten viser siste gjennomførte besøk og neste avtale (`visitTimeline`).
- `visits` – id, `client_id`, `doctor_id`, dato, `notes` (intern, aldri for klienten), `recommendations` (råd etter behandling, én per linje), `recommendations_lang`, `recommendations_edited` (legen har redigert rådene selv; `null` = lagret før kolonnen fantes → regnes som redigert når det finnes tekst, `storedAsEdited`), timestamps. Gamle kolonner `home_care_recommendations` og `procedure_plan` beholdes og vises som «Архив» (kun lesbart).
- `visits.face_scheme` – jsonb `{template: 'front-photo-v1'|'front', strokes: [{color: 'dark'|'red'|'blue', width, points: [[x,y], …]}]}`, koordinater 0–1 i forhold til malens bilde/boks (Z5, migrering `20261101000000_face_scheme.sql`). `front-photo-v1` = realistisk ansikt (2:3), brukes for alle nye skjemaer; `front` = gammel strektegning (3:4), kun visning; ukjent/manglende ID = `front`. `null` = ingen skjema; et tomt skjema lagres ikke. «Повторить прошлый визит» tar med skjemaet på sin egen mal.
- `client_photos` – id, `doctor_id`, `client_id`, `course_id` (valgfri: bildet hører til kuren), `taken_on` (opptaksdato), `storage_path`, `created_at` (FK1–FK4; migrering `20261103000000_client_photos.sql`). Filene i `visit-photos` under `<doctor_id>/client-photos/<client_id>/<fil>.jpg`. Radene er med i snapshot, filene ikke.
- `clients.main_photo_id` – «Главное фото» (FK6, migrering `20261105000000_main_photo.sql`); `null` = initialer. Fremmednøkkel `clients_main_photo_fkey` (`main_photo_id, id` → `client_photos (id, client_id)`, `on delete set null`, `deferrable initially deferred`) – bildet må være klientens eget, og slettes bildet, blir valget tomt. **Embed fra `clients` til `client_photos` må derfor ha hint** (`client_photos!client_photos_client_id_doctor_id_fkey(...)` for alle bildene, `client_photos!clients_main_photo_fkey(...)` for hovedbildet), ellers svarer PostgREST PGRST201.
- `visits.remind_on` / `visits.reminder_done_at` – «Напомнить через» (N7, migrering `20261106000000_visit_reminder.sql`): dagen «⏰ Пора» begynner (`null` = ingen), og når «Готово» ble trykket (`null` = åpen). **N7 ✏️ (Loya 05.11.2026):** behandlingstypen fra besøket (`OpenReminder.types`) vises **bare øverst i listen** (gruppert per type, `dueByType`) og **i kortet** ved hver «Готово»; raden i listen er uendret. Korte navn for BT-01…BT-10 i `messages/*.json` → `reminders.short` (Ботокс, Филлеры, Биоревитализация …), egne typer med eget navn, «Процедура» uten preparater (`reminderTypeLabel`). «Готово» lukker **én** påminnelse (ett besøk, `markReminderDone`). Endres datoen, åpnes påminnelsen igjen (`keptReminderDone`). «Повторить прошлый визит» tar ikke med påminnelsen. Regler i `src/logic/rules/reminders.ts` (`reminderDate`, `parseReminder`, `reminderChoiceFor`, `reminderStatus`).
- `visit_items` – id, `doctor_id`, `visit_id`, `preparation_id` (nullable), `preparation_name` og `procedure_type_id` (kopier på besøkstidspunktet, P9), `quantity` (fritekst), `sort_order`
- `visit_photos` – id, `doctor_id`, `visit_id`, `storage_path`, `sort_order`; maks 3 per besøk (trigger + app). Filene ligger i den private Storage-bøtten `visit-photos` under `<doctor_id>/<visit_id>/<fil>.jpg` (eier + aal2). Filene er **ikke** med i `backup.take_snapshot` – se `docs/BACKUP.md` punkt 8.

**Katalog (MVP 1b, migrering `20261026000000_catalog.sql`):**
- `zones` – id, `doctor_id`, `code` (stabil nøkkel for startdata), `name` (jsonb ru/uk/pl/en), `zone_group` (`upper`/`middle`/`lower`/`body`/`other`), `sort_order`, `active`
- `procedure_types` – id, `doctor_id`, `code` (BT-01 … BT-10), `name` (jsonb), `sort_order`, verdifelt (se under), `active`
- `procedure_type_zones` – tillatte soner per type (`procedure_type_id`, `zone_id`, `doctor_id`)
- `preparations` – id, `doctor_id`, `procedure_type_id`, `name`, `manufacturer`, `favorite`, de samme verdifeltene som typen (alle valgfrie = overstyring), `active`
- Verdifelt: `dose_text`, `dose_unit`, `course_min/max`, `interval_min/max/unit` (`days`/`weeks`/`months`), `maintenance_min/max/unit`, `maintenance_as_needed` («по показаниям»), `control_after_days` (0 = ingen kontroll), `advice` (jsonb ru/uk/pl/en, én anbefaling per linje), `advice_review` (språk som er oversettelser og «требует проверки»)
- Arv: `effectivePreparationSettings` i `src/logic/rules/catalog-settings.ts`. Gruppene dose, kur, intervall, vedlikehold, kontroll og råd arves eller overstyres hver for seg som en helhet. `null` på preparatet = arv.
**Склад (SK1, migrering `20261108000000_stock.sql`):**
- `stock_items` – id, `doctor_id`, `preparation_id` (unik per lege), `started_on` (trekk fra besøk fra denne datoen), `vial_sizes` int[] (`null` = шт).
- `stock_receipts` – id, `doctor_id`, `stock_item_id`, `received_on`, `vial_size`, `count`, `opened_on` + `remaining` (allerede åpnet glass), `lot`, `expires_on`.
- `stock_adjustments` – id, `doctor_id`, `stock_item_id`, `happened_on`, `kind` (`discard` = glass kastet / `set` = rest satt), `vial_key` (`<receipt_id>:<n>`), `amount`.
- Alle tre er med i `backup.take_snapshot` (gjenoppretting: `docs/BACKUP.md` 6c).

- Startdata: `private.seed_catalog(doctor_id)` (idempotent). For en ny lege: `select private.seed_catalog('<user id>');`

**Eksport til Google Drive (EX1 del 1, migrering `20261102000000_export.sql`, veiledning i `docs/EXPORT.md`):**
- `private.export_settings` – én rad (id = 1) med `secret_hash` (bcrypt) og `updated_at`. Ingen tilgang for anon/authenticated.
- `private.new_export_secret()` – lager nytt eksportpassord (64 hex), lagrer bare hashen, returnerer passordet én gang. Kun `postgres` (SQL Editor). Kjøres på nytt hvis passordet har lekket.
- `public.export_all(p_secret)` – `security definer`, kun `execute` for anon. Feil/manglende passord → `not allowed` uten detaljer. Returnerer `{exported_at, tables: {<tabell>: [...]}}` for **alle tabeller i `public` med `doctor_id`** (nye tabeller kommer med automatisk) – bare metadata og filnavn, aldri filinnhold.
- `scripts/google-drive-export.gs` – Google Apps Script, **ikke en del av appen**. Leser `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `EXPORT_SECRET`, `DRIVE_FOLDER_ID` fra Script Properties, kaller `rpc/export_all` med passordet i body, lager regnearket «LOA eksport ÅÅÅÅ-MM-DD» i «Loya Beauty app» → «Eksport» (mappe via ID) med faner på russisk, flytter bare egne «LOA eksport»-filer eldre enn 30 dager i papirkurven, daglig trigger kl. 03–04 (`setupTrigger`). Anamnese-etikettene er kopiert fra `kartaTemplate.ts`/`messages/ru.json` – **oppdater skriptet når malen endres**, og legg til en fane når en ny tabell skal vises.

**HTML-arkiv (EX1 del 2, «Скачать архив», migrering `20261107000000_archive_downloads.sql`):**
- Sikkerhetskopi for **mennesker**: blokken «Резервная копия» i ⚙ (`ArchiveBlock`, `/settings`) med «Последний архив: <dato> (N дней назад)», rød etter 14 dager (`archiveAge`), og «⬇ Скачать архив».
- Lages **i nettleseren** med vanlig innlogging (ingen `service_role`, ingen tidsgrense i Vercel): `archiveStartAction` (klientene A–Я) → `archiveClientAction` per klient (data + signerte lenker, «Подготовка архива… N из M») → filene hentes rett fra Storage → `renderArchive` (`src/archive/`, React til statisk HTML, alltid på russisk) → ZIP med `fflate` → «LOA arkiv ÅÅÅÅ-MM-DD.zip» → `archiveSavedAction` lagrer tidspunktet i `archive_downloads` (id, `doctor_id`, `created_at`; eier + aal2).
- Innhold: `index.html`, `klienter/<id>.html` (samme rekkefølge som kortet, alt åpent, ansiktsskissen tegnet på malen), `stil.css` (LOA-farger, lys/mørk, utskrift), `filer/<bøtte>/<sti uten doctor_id>` (originaler, `archiveFilePath`) og `filer/face-front.webp`. Ingen knapper, skjemaer eller skript; slettede klienter er ikke med. Regler i `src/logic/rules/archive.ts`, brukstilfeller i `src/logic/usecases/archive.ts` (`collectArchive`, `listArchiveClients`, `getArchiveClient`).
- **Endres kortet, oppdater arkivsiden** (`src/archive/ArchivePages.tsx`).

**Alle tabeller har `doctor_id`** og **Row Level Security**: en lege ser kun sine egne rader (`doctor_id = auth.uid()`). Forbered for flere leger senere.

Alder (AG1): lagre alder + registreringsdato; vis `alder + (år siden registrering)`. Hvis `birth_date` finnes, bruk den.

## Malen «Карта клиента» (fra Loyas notat – behold rekkefølge og etiketter)

Hvert felt: fritekst er alltid tillatt (også «?» for usikkerhet). Hurtigvalg der alternativer er oppgitt. **Kun navn er påkrevd.**

1. **Общие данные** (personalia): Дата (standard i dag) · Ф.И.О · Возраст (eller дата рождения) · Телефон · E-mail · Место постоянного проживания (страна + город) · Язык
   - E-mail trengs til e-resepter. Valgfritt, men valider formatet hvis utfylt.
   - Land: velg fra liste (vanligste først: Польша, Украина, Беларусь, Германия, Норвегия …) + mulighet for annet. Lagre ISO-kode, vis navnet på brukerens språk.
   - **Landet vises i klientlisten og øverst i kortet** (f.eks. flagg + landsnavn), slik at legen ser det med en gang.
   - **Жалобы hører IKKE hjemme her** (Loyas tilbakemelding) – se seksjon 2.
2. **Жалобы** (første del av den kliniske informasjonen): hurtigvalg тон кожи, покраснение, акне, подкожные воспаления, пигментация, морщины, сухость, расширенные поры, «гусиная кожа» + fritekst
3. **Состояние здоровья:** Артериальное давление · Эндокринная система · Желудочно-кишечный тракт · Сердце и сосуды · Мочеполовая система · Дыхательная система · Травмы и операции · Аллергоанамнез · Принимаемые препараты (БАДы, витамины, лекарства, контрацептивы) – alle fritekst, vis «—» når tomt
4. **Состояние кожи:**
   - Тип кожи: сухая, жирная, комбинированная, нормальная, чувствительная
   - Особенности кожи: пигментация, шелушения, высыпания, рубчики
   - Болезни кожи: акне, купероз, постакне, розацеа
5. **Возрастные изменения:**
   - Типы старения кожи: фотостарение, хроностарение, мышечный, мелкоморщинистый, отёчно-деформационный
   - Виды морщин: статические, динамические, мимические, гравитационные
6. **Ранее проведённые процедуры:**
   - В салоне: чистка, пилинг, SMAS, биоревитализация, ботокс, филлеры губ, полимолочная кислота
   - Инъекционные вмешательства
7. **Визиты** (nyeste øverst): Дата · Препараты (fra katalogen eller manuelt, flere) + Количество (fritekst) · Фото наклейки (1–3 per besøk) · Заметки (interne) · Напомнить через (N7: 2 нед. … 6 мес. eller egen dato) · Рекомендации после процедуры (fylles fra katalogen på klientens språk, kan redigeres; redigert tekst overskrives aldri uten «Обновить рекомендации?»; hos legen sammenfoldet til én linje, AL1-varsel alltid synlig)
8. **План процедур** (fritekst) – i klientkortet, ikke i besøket (PP1)

+ **Заметки** (fritekst) og **AL2:** allergier og medisiner vises tydelig øverst i kortet når de er fylt ut.

## Design – «LOA – Aesthetic Medicine»

- **Mobil først (iPhone), mørk modus følger systeminnstillingen.** Rolig, eksklusiv, beige/gull.
- Bruk Loyas ord: **«клиент», «Карта клиента»** (ikke «пациент») – også for klienter på behandling (1c).

**Farger** – CSS-variabler i `src/app/globals.css`, brukt som Tailwind-tokens (`bg-bg`, `bg-surface`, `text-ink`, `text-muted`, `border-line`, `border-field`, `text-gold`, `text-accent`, `bg-primary`/`text-on-primary`, `bg-alert`/`text-on-alert`). Ingen `neutral-*`/`red-*` eller `dark:`-klasser i komponentene.

| Token | Lys | Mørk | Bruk |
|---|---|---|---|
| `bg` | #F4ECE2 | #1E1814 | Bakgrunn |
| `surface` | #FBF7F2 | #2A221D | Kort og flater |
| `line` | #EADFD2 | #3A2F28 | Skillelinjer |
| `field` | #D9C9B6 | #806D5C | Kantlinjer på felt |
| `ink` | #2A211D | #F4ECE2 | Tekst |
| `muted` | #6B5B4E | #BFAE9C | Sekundærtekst |
| `gold` | #9C7A50 | #C9A57A | Logo |
| `accent` | #7A5A36 | #C9A57A | Lenker, tekstknapper |
| `primary` / `on-primary` | #2A211D / #F4ECE2 | #C9A57A / #1E1814 | Primærknapp, valgt pille |
| `alert` / `on-alert` | #F6E3DC / #8A2E1E | #4A2620 / #F2B8A8 | Allergivarsel, feilmeldinger, sletting |

- All tekst har minst **4.5:1** kontrast. Unntak: `gold` i lys modus (3.4:1) brukes **kun i logoen** (LOA, stjerne, bue) – aldri til vanlig tekst.

**Skrift** (via `next/font`, med `latin`, `latin-ext` og `cyrillic`):
- **Cormorant Garamond 500** (`font-serif`): logo og overskrifter.
- **Montserrat 400/500/600** (`font-sans`, standard): all annen tekst.

**Regler:**
- Alle knapper og trykkflater er **minst 44 px høye** (`min-h-11`).
- **Ikonknapper har alltid tekst** («+ Новый клиент», «+ Препарат»), unntatt helt standard symboler som «‹ tilbake».
- **Fanelinje nederst** (iOS-stil, `TabBar`): **«Сегодня» · «Клиенты» · «Препараты» · ⚙** (TD1/ST1, 05.11.2026). «Сегодня» har et tall (`countToday`/`todayCount`: klienter med «⏰ Пора», time i dag eller bursdag, hver én gang), beregnet i `(app)/layout.tsx`. ⚙ er **bare ikon** (`iconOnly`, navnet i `aria-label`) – godkjent unntak fra regelen om tekst på ikonknapper, som «‹». Ikon + tekst ellers, aktiv fane i `accent`, minst 44 px, over hjemindikatoren (`--safe-bottom` = `env(safe-area-inset-bottom)`). Fanene står i `src/config/navigation.ts` – en ny fane (f.eks. «Наблюдение», MVP 3) er én linje der + tekst i `messages/*.json` + ikon. Fanelinjen vises bare på hovedsidene, aldri i skjemaer (`/new`, `/edit`).
- **Lastevisning:** `loading.tsx` med `PageSkeleton` (liste, kort, side) – et trykk gir alltid synlig respons.
- **Miniatyrer:** hvert bilde i `visit-photos` får en liten kopi (ca. 320 px, `<id>-t.jpg`, laget med `sharp` i `photos-supabase.ts` ved opplasting; slettes sammen med originalen). `signedUrls` signerer begge; `<img>` bruker `thumbUrl` (liten kopi, ellers originalen for eldre bilder), lenken åpner originalen.
- **Bilde av klienten (FK6):** hovedbildet Loya har valgt («★ Сделать главным» i «Фото клиента») som rundt bilde (`ClientPicture`) i klientlisten og ved navnet i kortet; initialer når hun ikke har valgt noe. Ikke lenger automatisk det nyeste bildet.
- **Region:** `vercel.json` låser funksjonene til `fra1` (samme region som Supabase). Ikke fjern den – i USA ble appen treg.
- Felt har radius **14 px**, kort radius **18 px**. Felles klasser i `src/app/components/ui.ts`.
- Datoer `DD.MM.YYYY`.
- **Innlogging:** stor «LOA» i gull serif med liten firkantet stjerne over og tynn bue under, «AESTHETIC MEDICINE» med bred bokstavavstand, linje med stjerne, «SCIENCE · BEAUTY · CONFIDENCE» (`BrandHero`). Skjema i kort under.
- **Klientliste** (som Apple Notater): liten «LOA» øverst til venstre, «+ Новый клиент» til høyre, stor serif-overskrift «Клиенты» med antall under, **søk rett under overskriften**. Bare søk, filter og listen (TD1) – «⏰ Пора», timer og bursdager står i fanen **«Сегодня»** (`/today`, `TodayView`), og «Резервная копия», «Удалённые клиенты», språk og «Выйти» i **⚙** (`/settings`, `SettingsView`). Under søket to filterpiller «Косметология» / «Дерматология» (DM1): trykk velger, trykk igjen fjerner, ingen valgt = alle. **Fanen «Сегодня»:** «⏰ Пора» gruppert per behandlingstype («Ботокс · 2» med navn, N7), «Записи» («Сегодня» / «Завтра», N13 delvis, `agendaDay`) og «Дни рождения» (BD1, `isBirthday`), hver pille åpner kortet; «На сегодня всё спокойно» når tomt. Listen i ett kort; hver rad: rundt bilde av klienten (eller initialer), navn (fet), dato · alder, «💉 Ботокс · 1 мес. 2 нед.» (BO1: tid siden siste gjennomførte besøk med type BT-01, `botoxSince`/`timeSince`), «🎂 День рождения сегодня» (BD1), «⏰ Пора на процедуру» (N7), «Запись: 31.10», «🩺 На лечении · N дн.» / «Курс закончился», utdrag; til høyre landskode, ✨/🩺 og eventuelt rød «Аллергия».
- **Препараты** (katalogen, URL `/catalog`): liten «LOA» og «+ Препарат» øverst, serif-overskrift «Препараты», søk i preparater, typene i ett kort.
- **Klientkort – rekkefølge** (Loya 26.10.2026: «план процедур и визиты должны быть первыми»):
  1. **Toppen:** liten «КАРТА КЛИЕНТА» over navnet (serif), under: alder · første besøk, «🎂 Сегодня день рождения · N лет» (BD1, bare på dagen), «💉 Ботокс · …» (BO1), landskode + land, by, telefon med «Позвонить», «WhatsApp», «Telegram», «Viber» (KT1). **Allergivarsel (AL2)** rett under, avrundet boks med varseltrekant. **«⏰ <behandling> · с <dato>»** (N7) per påminnelse som har kommet, hver med egen «Готово»; ellers «⏰ Напомнить: <dato>» øverst.
  0. **Snarveier** rett under toppen: piller «Визиты · Фото клиента · План процедур · Лечение · Уход · Документы и анализы · Заметки · Анкета» som hopper til seksjonen (ankre `#visits`, `#client-photos`, `#plan`, `#treatment`, `#care`, `#documents`, `#notes`, `#anketa`).
  1b. **«Последний визит»** (H1) – siste gjennomførte besøk: dato, «N дней назад», preparater med mengde, 📷/skisse, notater (2 linjer), «↺ Повторить прошлый визит».
  2. **«Предстоящие визиты»** – planlagte besøk (VP2), bare når det finnes noen; «Дополнить визит» når klienten kommer.
  3. **«Визиты»** med «+ Новый визит» og «↺ Повторить прошлый визит» (RV1); nyeste øverst, hver rad kan åpnes.
  3b. **«Фото клиента»** (FK1–FK4, FK6) – kosmetologibilder etter dato (nyeste øverst), «+ Фото», «★ Сделать главным» / «Убрать из главного» (merke «★ Главное» på bildet), «Удалить» med bekreftelse (panel nederst). Vises ikke hos klienter med bare «Дерматология» (med mindre det alt finnes bilder). Bilder fra en kur står i kuren i «Лечение».
  4. **«План процедур»** (PP1).
  5. **«Лечение»** (LE5) – aktiv kur: diagnose, назначение, datoer, «Осталось N дней» med fremdriftslinje, kontroll av analyser («Последние анализы» kan endres eller tømmes – da regnes neste fra startdatoen), bilder av resepter; «Завершённые курсы» lukket (LE9); tilknyttede analyser under «Анализы» (LE8); «Фото клиента» med «+ Фото» i den aktive kuren (FK3), og bildene blir med i «Завершённые курсы».
  5b. **«Уход»** (UH1/UH2) – fritekst, «Обновлено: <dato>», bilder som åpnes i full størrelse.
  5c. **«Документы и анализы»** (DK1/DK3/DK5) – «+ Документ», nyeste øverst, «Открыть» (signert lenke), «Удалить» med bekreftelse.
  6. **«Заметки»**.
  7. **«Анкета»** nederst, lukket som standard (hver klinisk seksjon har «Изменить» → `/clients/[id]/anamnesis/<seksjon>/edit`, som bare lagrer den seksjonen, `mergeAnamnesisSection`, AN3): Общие данные, Жалобы, Состояние здоровья, Состояние кожи, Возрастные изменения, Ранее проведённые процедуры – hver seksjon kan åpnes og viser kort sammendrag; under tittelen «✓ Анамнез подтверждён: <dato>» (AN3).
  8. **«Удалить клиента»** (PR6) helt nederst, rød, bekreftelse i panel nederst på skjermen.
  - **Fast knapperad** over fanelinjen (`CardActions`): «+ Визит», «↺ Повторить» (når det finnes et besøk å gjenta) og «+ Фото» («Фото клиента», eller aktiv kur for klienter med bare «Дерматология»). WhatsApp er ikke i knapperaden (fjernet 31.10.2026) – ring og meldinger ligger øverst i kortet (KT1).
  - Hver seksjon i eget kort med serif-overskrift; etikett/verdi-rader som i notatet; «—» når tomt. Жалобы som piller (valgt = mørk fylt med ✓).
- **PWA-ikon:** midlertidig «LOA» i gull serif på #F4ECE2 (`public/icon-*.png`, `apple-touch-icon.png`, `src/app/icon.png`). Temafarge #F4ECE2 (mørk: #1E1814). Bytt ut når `design/loa-icon.png` finnes.
- **Ansiktsmal (Z5):** realistisk ansikt forfra med hals og skuldre (`public/templates/face-front.webp`, laget fra `design/face_cosmetics.PNG` 1024×1536; SVG-boks 300×450). Tegneflaten har samme sideforhold (2:3), er aldri høyere enn skjermen (hele ansiktet og halsen synlig uten å skrolle) og har `touch-action: none`. Bildet ligger alltid på lys bakgrunn (`bg-face-paper`, også i mørk modus). Penner `--pen-dark` (nesten svart), `--pen-red` (klar rød), `--pen-blue` (klar blå) – like i begge moduser, synlige på hud, aldri gull/beige. Gammel strektegning (`front`, 300×400, linjer i `--face-line`) brukes kun til å vise eldre skjemaer. (`design/face-template.webp` er ikke i bruk.)
- **REGEL – «Схема лица» kun kosmetologi (Z5, MVP 6):** skjemaet finnes bare i besøk, aldri i behandlingskurer. Hos klienter med `direction` kun «Дерматология» vises ikke seksjonen «Схема лица» i besøket (og «Повторить прошлый визит» tar ikke med skjema); med «Косметология», begge eller uten retning vises den (`showsFaceScheme`). Et skjema som allerede finnes på besøket beholdes. Klienten ser aldri skjemaet. Strukturerte soner (MVP 6: Z8, Z3, Z7) er også kun kosmetologi.

## Språk

Rekkefølge: **ru (standard)**, uk, pl, en. Alle UI-tekster i `messages/*.json` – ingen hardkodede strenger. Bruk riktig flertall (ICU). Datoformat `DD.MM.YYYY`.

## Sikkerhet og personvern

- **Utkast (DR1):** «Новый визит» og «Новый клиент» lagres lokalt i nettleseren (`localStorage`, `src/app/components/draft.ts`), slettes ved lagring, ved utlogging og etter 7 dager. Bilder lagres aldri i utkastet.
- Data er helseopplysninger (GDPR art. 9). Kun legen har tilgang i fase 1–2.
- Innlogging: e-post med engangskode + to-faktor (TOTP) for legen.
- **Aldri** `service_role`-nøkkel i klientkode eller i repoet. Hemmeligheter kun i miljøvariabler.
- **Ingen ekte klientdata i repoet**, seed-filer eller tester – kun oppdiktede navn.
- Ikke logg personopplysninger.
- **Eksporten (EX1)** inneholder helseopplysninger i Google Drive: mappen deles ikke, eksportpassordet ligger bare i Script Properties (aldri i repoet), og bare hashen i databasen.

## Databaseendringer

Det ligger ekte klientdata i produksjon. Se `docs/BACKUP.md` for backup og gjenoppretting.

- **Hver ny migrering starter med:** `select backup.take_snapshot('før migrering <filnavn>');`
- **Migreringer skal kun LEGGE TIL.** Aldri `DROP`, `TRUNCATE`, `DELETE` eller endret kolonnetype uten eksplisitt godkjenning.
- **Endre navn:** legg til ny kolonne og kopier data. Ikke rename eller drop i samme migrering.
- **Hver PR med migrering har linjen** «Migreringen er trygg: kun tillegg» eller «⚠️ Migreringen endrer eller sletter data: …».
- **Migreringer skal tåle å kjøres to ganger** (`if not exists`, `create or replace`, sjekk før endring).
- Når en kolonne legges til i `clients` eller `visits`: oppdater kolonnelisten i gjenopprettings-SQL-en i `docs/BACKUP.md` i samme PR.

## Arbeidsmåte

- Små PR-er, én historie eller en liten gruppe om gangen.
- Oppdater `roadmap_ru.md` hvis omfanget endres.
- Når noe er uklart i Loyas arbeidsflyt: velg det enkleste, noter antakelsen i PR-beskrivelsen.
- **Filnavn i `public/` skrives alltid med små bokstaver** (også endelsen: `.webp`, `.png`, aldri `.PNG`). Vercel skiller mellom store og små bokstaver, så `face.PNG` ≠ `face.png`. Kildefiler i `design/` kan ha hvilket navn som helst – den optimaliserte kopien i `public/` får små bokstaver (f.eks. `design/face_cosmetics.PNG` → `public/templates/face-front.webp`). Testen i `src/app/components/face/templates.test.ts` stopper store bokstaver i `public/`.
