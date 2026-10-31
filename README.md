# loya-app

Карта клиента для врача (MVP 1a). Next.js (App Router) + TypeScript + Tailwind + Supabase (EU).
Se `roadmap_ru.md` for innhold og prioritering.

## Struktur

| Mappe | Innhold |
|---|---|
| `src/app` | Sider og UI (App Router) |
| `src/logic/rules` | Rene domeneregler (f.eks. AG1 alder), med Vitest-tester |
| `src/logic/usecases` | Brukstilfeller og repository-porter; ingen Supabase her |
| `src/data` | Supabase-klienter og repository-implementasjoner |
| `src/config` | Språk, ruter, miljøvariabler, next-intl-oppsett |
| `messages/*.json` | Alle tekster (`ru` standard, `uk`, `pl`, `en`) |
| `supabase/migrations` | SQL-migreringer |

## Kjøre lokalt

```bash
cp .env.example .env.local   # fyll inn verdier fra Supabase
npm install
npm run dev                  # http://localhost:3000
npm test                     # Vitest
npm run lint && npm run typecheck
```

## Supabase – engangsoppsett

1. Opprett prosjekt i **EU-region** (f.eks. Frankfurt).
2. **Kjør migreringene** i rekkefølge, én gang hver: Dashboard → **SQL Editor** → *New query* →
   lim inn hele filen → **Run**.
   1. `supabase/migrations/20261022000000_clients_visits.sql` (oppgave 1)
   2. `supabase/migrations/20261023000000_client_card.sql` (oppgave 2: alder, fødselsdato, `anamnesis`)
   3. `supabase/migrations/20261024000000_karta_template.sql` (oppgave 3: e-post, bosted, kliniske seksjoner i `anamnesis`)
   4. `supabase/migrations/20261025000000_backup.sql` (sikkerhetskopi, se `docs/BACKUP.md`)
   5. `supabase/migrations/20261026000000_catalog.sql` (MVP 1b: katalog over behandlingstyper, soner og preparater med startdata)
   6. `supabase/migrations/20261027000000_visit_items.sql` (MVP 1b: preparater og bilder i besøket, plan i klientkortet, Storage-bøtten `visit-photos`)
   7. `supabase/migrations/20261028000000_recommendations_edited.sql` (MVP 1b: husker om rådene er redigert for hånd)
   8. `supabase/migrations/20261029000000_anamnesis_confirmed.sql` (MVP 1b: dato for «Анамнез без изменений ✓»)
   9. `supabase/migrations/20261030000000_treatment_courses.sql` (MVP 1c: retning og behandlingskurer med bilder av resepter)
  10. `supabase/migrations/20261031000000_care_documents.sql` (MVP 1c: «Уход» med bilder, dokumenter og analyser i bøtten `client-documents`)
  11. `supabase/migrations/20261101000000_face_scheme.sql` (MVP 1b: ansiktsskisse i besøket, lagret som streker)
  12. `supabase/migrations/20261102000000_export.sql` (EX1: nattlig eksport til Google Drive, se `docs/EXPORT.md`)
  13. `supabase/migrations/20261103000000_client_photos.sql` (FK1–FK4: bilder fra klienten i kortet og i kuren)
  14. `supabase/migrations/20261104000000_client_trash.sql` (PR6: «Удалить клиента» med papirkurv i 30 dager)

   Kontroller under *Table Editor* at `clients` og `visits` finnes og at RLS står som *enabled*.
3. **Opprett legens bruker:** *Authentication → Users → Add user* (e-post). Appen oppretter
   ikke brukere selv (`shouldCreateUser: false`).
4. **Slå av selvregistrering:** *Authentication → Sign In / Providers →* skru av *Allow new users to sign up*.
5. **E-post med kode i stedet for lenke:** *Authentication → Emails → Magic Link*-malen må inneholde
   `{{ .Token }}`, f.eks. `<p>Код для входа: <strong>{{ .Token }}</strong></p>`.
6. **TOTP:** *Authentication → Multi-Factor* – TOTP skal være aktivert (standard).
7. **URL-er:** *Authentication → URL Configuration* – sett *Site URL* til Vercel-domenet.

Første innlogging: e-postkode → skann QR-kode i autentiseringsapp → appen.
Senere innlogging: e-postkode → 6-sifret TOTP-kode.

## Vercel – miljøvariabler

Sett under *Project → Settings → Environment Variables* (Production og Preview):

| Variabel | Hvor finnes den |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → `anon` public key |

Anon-nøkkelen er offentlig by design; tilgang styres av RLS (`doctor_id = auth.uid()` og krav om `aal2`).
Bruk aldri `service_role`-nøkkelen i appen.

## Legge på hjemskjerm (iPhone)

Åpne appen i Safari → Del → **Legg til på Hjem-skjerm**. Mørk modus følger systeminnstillingen.
