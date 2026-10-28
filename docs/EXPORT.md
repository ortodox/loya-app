# Nattlig eksport til Google Drive (EX1, første del)

Hver natt mellom kl. 03 og 04 (polsk tid) lages et Google Regneark med alle data fra appen. Regnearket heter «LOA eksport ÅÅÅÅ-MM-DD» og legges i mappen **«Loya Beauty app» → «Eksport»** i Google Drive.

- **Med i eksporten:** klienter med hele anamnesen, besøk, preparater i besøkene, behandlingskurer, «Уход», bilder, dokumenter og katalogen. Hver del har sin egen fane på russisk.
- **Ikke med ennå:** selve filene (bilder og PDF-er). Bare navnet på hver fil er med. Filene kommer i en senere del av EX1.
- **Opprydding:** eksporter som er eldre enn 30 dager, flyttes automatisk til papirkurven. Det gjelder bare filer i «Eksport» som har et navn som begynner med «LOA eksport». Skriptet rører aldri noe annet.

> ⚠️ **Regnearkene inneholder helseopplysninger.** Ikke del mappen «Loya Beauty app» eller «Eksport» med noen. Bruk en Google-konto med totrinnsbekreftelse.

Hvordan det henger sammen: et lite program hos Google (Apps Script) spør databasen om alle data. Databasen svarer bare når programmet sender riktig **eksportpassord**. I databasen lagres bare et «fingeravtrykk» av passordet (en hash), aldri selve passordet.

Du trenger: tilgang til Supabase-prosjektet, Google-kontoen der mappen «Loya Beauty app» ligger, og ca. 20 minutter.

---

## 1. Kjør migreringen i Supabase

1. Gå til <https://supabase.com/dashboard> og åpne prosjektet til Loya-appen.
2. Klikk **SQL Editor** i menyen til venstre.
3. Klikk **+ New query**.
4. Åpne filen `supabase/migrations/20261102000000_export.sql` i GitHub. Klikk **Raw** og kopier hele teksten.
5. Lim teksten inn i SQL Editor og klikk **Run** nederst til høyre.
6. Du skal se **Success**. Meldinger om at noe «already exists» er helt i orden.

Migreringen tar først en sikkerhetskopi (`backup.take_snapshot`) og legger bare til nye ting. Den endrer og sletter ingenting, og den kan trygt kjøres flere ganger.

## 2. Lag eksportpassordet

1. Klikk **+ New query** igjen i SQL Editor.
2. Skriv:
   ```sql
   select private.new_export_secret();
   ```
3. Klikk **Run**.
4. Resultatet er en lang rad med tall og bokstaver (64 tegn). **Kopier den nå og ta vare på den til steg 4.** Passordet vises bare denne ene gangen, og det kan ikke hentes fram igjen senere.
   - Ikke lagre passordet i et dokument, i e-post eller i en chat. Det skal bare inn i Script Properties i steg 4.
   - Mister du det, lager du bare et nytt (se steg 7).

## 3. Finn de tre andre verdiene

**Mappe-ID (`DRIVE_FOLDER_ID`):**
1. Åpne <https://drive.google.com> og dobbeltklikk på mappen **«Loya Beauty app»**.
2. Se på adressen øverst i nettleseren, for eksempel:
   `https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz`
3. Mappe-ID-en er **den siste delen etter `/folders/`**, her `1AbCdEfGhIjKlMnOpQrStUvWxYz`. Står det `?` etter ID-en, tar du bare med det som står før `?`.

Skriptet finner mappen ut fra ID-en, ikke navnet. Det gjør ikke noe om mappen får nytt navn eller flyttes.

**Supabase-adresse (`SUPABASE_URL`) og offentlig nøkkel (`SUPABASE_ANON_KEY`):**
1. Klikk tannhjulet **Project Settings** nederst til venstre i Supabase.
2. Under **Data API** står **Project URL**, for eksempel `https://abcdefgh.supabase.co`. Kopier den.
3. Under **API Keys** står nøkkelen **anon public** (eller **Publishable key**). Kopier den.
   - Det er den samme offentlige nøkkelen som appen bruker (`NEXT_PUBLIC_SUPABASE_ANON_KEY` i Vercel).
   - Bruk **aldri** nøkkelen `service_role` eller **Secret key**.

## 4. Lag Apps Script-prosjektet

1. Gå til <https://script.google.com>. Bruk samme Google-konto som eier mappen «Loya Beauty app».
2. Klikk **+ Nytt prosjekt** (New project).
3. Klikk på navnet «Prosjekt uten navn» øverst og gi prosjektet navnet **LOA eksport**.
4. Til venstre er filen `Kode.gs` (eller `Code.gs`) åpen. Merk alt som står der og slett det.
5. Åpne `scripts/google-drive-export.gs` i GitHub, klikk **Raw**, kopier alt og lim det inn.
6. Klikk lagre-ikonet (💾) eller trykk Ctrl+S / Cmd+S.
7. Klikk tannhjulet **Prosjektinnstillinger** (Project Settings) i menyen til venstre.
8. Velg **(GMT+01:00) Central European Time – Warsaw** under **Tidssone**, hvis det ikke står der allerede.
9. Bla ned til **Skriptegenskaper** (Script Properties) og klikk **Legg til skriptegenskap**. Legg inn disse fire. Navnene må skrives nøyaktig slik, med store bokstaver:

   | Egenskap | Verdi |
   |---|---|
   | `SUPABASE_URL` | Project URL fra steg 3 |
   | `SUPABASE_ANON_KEY` | anon public / Publishable key fra steg 3 |
   | `EXPORT_SECRET` | passordet fra steg 2 |
   | `DRIVE_FOLDER_ID` | mappe-ID-en fra steg 3 |

10. Klikk **Lagre skriptegenskaper**.

Verdiene står bare i Script Properties, aldri i selve skriptet. Ikke lim dem inn i koden.

## 5. Kjør eksporten første gang og godkjenn tilgang

1. Klikk **Redigeringsprogram** (`< >`) i menyen til venstre.
2. Velg **exportAll** i nedtrekkslisten øverst, ved siden av «Feilsøk».
3. Klikk **▶ Kjør**.
4. Google ber om tillatelse: klikk **Gå gjennom tillatelser** og velg Google-kontoen din.
5. Står det «Google har ikke bekreftet denne appen», er det fordi du har laget skriptet selv. Klikk **Avansert** → **Gå til LOA eksport (utrygt)**.
6. Klikk **Tillat**. Skriptet ber om tilgang til Google Disk, Google Regneark og eksterne tjenester. Den siste trengs for å hente data fra Supabase.
7. Vent til det står **Kjøringen er fullført** nederst. Det tar vanligvis under ett minutt.

Kommer det en feil:
- «Mangler Script Properties: …» betyr at en av de fire egenskapene mangler eller er skrevet feil (steg 4).
- «HTTP 401» eller «HTTP 403» betyr at `EXPORT_SECRET` er feil. Lag et nytt passord (steg 7).

## 6. Slå på den nattlige kjøringen

1. Velg **setupTrigger** i nedtrekkslisten og klikk **▶ Kjør**.
2. Klikk klokkeikonet **Utløsere** (Triggers) til venstre. Det skal stå **én** utløser: `exportAll`, «Tidsstyrt», «Dagtimer», kl. 03–04.
   - Kjører du `setupTrigger` flere ganger, blir det fortsatt bare én.
3. Valgfritt: klikk blyanten på utløseren og sett **Varsler om feil** til **Varsle meg umiddelbart**. Da får du e-post med en gang hvis en nattlig eksport feiler.

**Sjekk resultatet:**
1. Åpne <https://drive.google.com> → **«Loya Beauty app»** → **«Eksport»**. Skriptet lager mappen «Eksport» selv hvis den ikke finnes.
2. Der skal regnearket **«LOA eksport ÅÅÅÅ-MM-DD»** med dagens dato ligge.
3. Åpne regnearket. Det har fanene **Клиенты, Визиты, Препараты в визитах, Курсы лечения, Уход и фото, Документы, Каталог**.
   - Den øverste raden er fet og står fast når du blar.
   - Datoer vises som DD.MM.YYYY.
   - Land vises med navn på russisk.
4. I morgen tidlig skal det ligge et nytt regneark med morgendagens dato.

I fanen **Каталог** betyr en tom celle hos et preparat at preparatet bruker verdien til behandlingstypen, altså raden «— настройки типа —» over.

## 7. Nytt passord, for eksempel hvis det har lekket

1. Kjør dette i Supabase → **SQL Editor** → **+ New query** → **Run**:
   ```sql
   select private.new_export_secret();
   ```
   Det gamle passordet slutter da å virke med en gang.
2. Kopier det nye passordet.
3. Åpne prosjektet **LOA eksport** på <https://script.google.com> → **Prosjektinnstillinger** → **Skriptegenskaper**. Klikk **Rediger skriptegenskaper**, lim det nye passordet inn som verdi for `EXPORT_SECRET` og klikk **Lagre**.
4. Kjør **exportAll** én gang og sjekk at det virker.

## Slik er det sikret

- **Passordet:** bare en bcrypt-hash av eksportpassordet ligger i databasen, i `private.export_settings`. Selve passordet finnes bare i Script Properties.
- **Funksjonen `public.export_all`:** svarer bare med riktig passord. Ved feil eller manglende passord svarer den bare «not allowed», uten detaljer. Passordet sendes i selve forespørselen, aldri i adressen.
- **Hva den kan:** bare lese. Den kan ikke endre eller slette noe.
- **Opprydding:** skriptet sletter aldri noe permanent. Gamle eksporter går til papirkurven i Google Drive og kan hentes tilbake derfra i 30 dager.
- **Logging:** skriptet logger ingen personopplysninger.
- **Flere tabeller:** nye tabeller med `doctor_id` kommer automatisk med i dataene fra databasen. Skal de vises i regnearket, må skriptet få en ny fane.
