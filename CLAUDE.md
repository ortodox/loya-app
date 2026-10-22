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
- `preparaty_chernovik_ru.md` – utkast til behandlingstyper, soner og preparater (ikke verifisert av Loya)

## Nåværende oppgave: MVP 1a – digital «Карта клиента»

Historier: L1, UI1, PR1, AG1, PR2, PR5, JA1, AN1, AN2, SK1, VI1, PH1, PR3, VS1, AL2 (se `roadmap_ru.md`).

Status: oppgave 1 (innlogging), 2 (klientliste) og 3 (resten av malen, e-post og bosted, Жалобы flyttet ut av «Общие данные») er ferdige. Gjenstår: oppgave 4, besøk (VS1).

**Ferdig når:** Loya kan opprette klienter, fylle ut hele malen, legge til besøk og finne klienter med søk – på iPhone – uten å trenge Notater.

**Ikke i MVP 1a:** preparater, behandlinger, tegning, deling, filer, neste dato. Ikke bygg det ennå.

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
    repositories/   DATALAG – grensesnitt (clients.ts) + Supabase-implementasjon (clients-supabase.ts)
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

## Design

- **Mobil først (iPhone), mørk modus støttes** (følg systeminnstilling).
- Klientlisten skal ligne Apple Notater: navn, dato for siste besøk, kort utdrag, **søk nederst**.
- Klientkortet: etikett/verdi-rader som i notatet hennes.
- Visuell retning fra designutkastet: rolig, eksklusiv, beige/gull-aksent, serif i overskrifter. Skriften må støtte kyrillisk og polske tegn.
- Bruk Loyas ord: **«клиент», «Карта клиента»** (ikke «пациент»).

## Språk

Rekkefølge: **ru (standard)**, uk, pl, en. Alle UI-tekster i `messages/*.json` – ingen hardkodede strenger. Bruk riktig flertall (ICU). Datoformat `DD.MM.YYYY`.

## Sikkerhet og personvern

- Data er helseopplysninger (GDPR art. 9). Kun legen har tilgang i fase 1–2.
- Innlogging: e-post med engangskode + to-faktor (TOTP) for legen.
- **Aldri** `service_role`-nøkkel i klientkode eller i repoet. Hemmeligheter kun i miljøvariabler.
- **Ingen ekte klientdata i repoet**, seed-filer eller tester – kun oppdiktede navn.
- Ikke logg personopplysninger.

## Arbeidsmåte

- Små PR-er, én historie eller en liten gruppe om gangen.
- Oppdater `roadmap_ru.md` hvis omfanget endres.
- Når noe er uklart i Loyas arbeidsflyt: velg det enkleste, noter antakelsen i PR-beskrivelsen.
