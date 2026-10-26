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

Historier: B1, P1, P2, P5, S2, R1, DO1, LOT1, Z5, R2, H1, P9, AL1, HE1, VS2, E2, E3, E4 (se `roadmap_ru.md`). Katalogen i `preparaty_ru.md`.

**Ferdig når:** Loya har registrert en behandling med ansiktsskisse og sendt siden til klienten, og den åpnes riktig på telefonen på klientens språk.

**Ikke i MVP 1b:** beregning av neste dato, kontrollbesøk og kurstrinn (MVP 2), påminnelser (MVP 2 og 4), filer (MVP 1c), strukturerte soner (MVP 6) og alt under «Позже». Ikke bygg det ennå.

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
- `visits` – id, `client_id`, `doctor_id`, dato, `home_care_recommendations`, `procedure_plan`, timestamps

**Katalog (MVP 1b, migrering `20261026000000_catalog.sql`):**
- `zones` – id, `doctor_id`, `code` (stabil nøkkel for startdata), `name` (jsonb ru/uk/pl/en), `zone_group` (`upper`/`middle`/`lower`/`body`/`other`), `sort_order`, `active`
- `procedure_types` – id, `doctor_id`, `code` (BT-01 … BT-10), `name` (jsonb), `sort_order`, verdifelt (se under), `active`
- `procedure_type_zones` – tillatte soner per type (`procedure_type_id`, `zone_id`, `doctor_id`)
- `preparations` – id, `doctor_id`, `procedure_type_id`, `name`, `manufacturer`, `favorite`, de samme verdifeltene som typen (alle valgfrie = overstyring), `active`
- Verdifelt: `dose_text`, `dose_unit`, `course_min/max`, `interval_min/max/unit` (`days`/`weeks`/`months`), `maintenance_min/max/unit`, `maintenance_as_needed` («по показаниям»), `control_after_days` (0 = ingen kontroll), `advice` (jsonb ru/uk/pl/en, én anbefaling per linje), `advice_review` (språk som er oversettelser og «требует проверки»)
- Arv: `effectivePreparationSettings` i `src/logic/rules/catalog-settings.ts`. Gruppene dose, kur, intervall, vedlikehold, kontroll og råd arves eller overstyres hver for seg som en helhet. `null` på preparatet = arv.
- Startdata: `private.seed_catalog(doctor_id)` (idempotent). For en ny lege: `select private.seed_catalog('<user id>');`

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
7. **Визиты** (nyeste øverst): Дата · Рекомендации по уходу дома · План процедур

+ **Заметки** (fritekst) og **AL2:** allergier og medisiner vises tydelig øverst i kortet når de er fylt ut.

## Design – «LOA – Aesthetic Medicine»

- **Mobil først (iPhone), mørk modus følger systeminnstillingen.** Rolig, eksklusiv, beige/gull.
- Bruk Loyas ord: **«клиент», «Карта клиента»** (ikke «пациент»).

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
- Alle knapper og trykkflater er **minst 44 px høye** (`min-h-11`, runde knapper `size-11`).
- Felt har radius **14 px**, kort radius **18 px**. Felles klasser i `src/app/components/ui.ts`.
- Datoer `DD.MM.YYYY`.
- **Innlogging:** stor «LOA» i gull serif med liten firkantet stjerne over og tynn bue under, «AESTHETIC MEDICINE» med bred bokstavavstand, linje med stjerne, «SCIENCE · BEAUTY · CONFIDENCE» (`BrandHero`). Skjema i kort under.
- **Klientliste** (som Apple Notater): liten «LOA» øverst til venstre, rund «+» til høyre, stor serif-overskrift «Клиенты» med antall under. Listen i ett kort; hver rad: navn (fet), dato · alder, utdrag; til høyre landskode og eventuelt rød «Аллергия». **Søk nederst.**
- **Klientkort:** liten «КАРТА КЛИЕНТА» over navnet (serif), under: alder · første besøk, landskode + land, by. Allergivarsel som avrundet boks med varseltrekant øverst. Hver seksjon i eget kort med serif-overskrift; etikett/verdi-rader som i notatet; «—» når tomt. Жалобы som piller (valgt = mørk fylt med ✓). Kliniske seksjoner som rader som kan åpnes, med kort sammendrag under tittelen.
- **PWA-ikon:** midlertidig «LOA» i gull serif på #F4ECE2 (`public/icon-*.png`, `apple-touch-icon.png`, `src/app/icon.png`). Temafarge #F4ECE2 (mørk: #1E1814). Bytt ut når `design/loa-icon.png` finnes.

## Språk

Rekkefølge: **ru (standard)**, uk, pl, en. Alle UI-tekster i `messages/*.json` – ingen hardkodede strenger. Bruk riktig flertall (ICU). Datoformat `DD.MM.YYYY`.

## Sikkerhet og personvern

- Data er helseopplysninger (GDPR art. 9). Kun legen har tilgang i fase 1–2.
- Innlogging: e-post med engangskode + to-faktor (TOTP) for legen.
- **Aldri** `service_role`-nøkkel i klientkode eller i repoet. Hemmeligheter kun i miljøvariabler.
- **Ingen ekte klientdata i repoet**, seed-filer eller tester – kun oppdiktede navn.
- Ikke logg personopplysninger.

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
