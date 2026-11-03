// EX1: the backup for people – plain pages that look like the app, linked to each other, no app needed.
// Rendered once to static HTML (render.tsx); no hooks, no client code.
import { FaceSchemeView } from "@/app/components/face/FaceSchemeView";
import { clinicalSections, generalDataFields } from "@/config/kartaTemplate";
import type { Visit } from "@/logic/client";
import type { TreatmentCourse } from "@/logic/course";
import { fieldText } from "@/logic/rules/anamnesis";
import { archiveFilePath, clientPagePath, fromClientPage, indexLetter } from "@/logic/rules/archive";
import { photoTimeline, splitClientPhotos } from "@/logic/rules/client-photos";
import { countryName } from "@/logic/rules/country";
import { formatIsoDate } from "@/logic/rules/dates";
import { documentsByCourse } from "@/logic/rules/documents";
import { hasArchive, isPlanned } from "@/logic/rules/visits";
import type { ArchiveClient, ArchiveData } from "@/logic/usecases/archive";

/** Translator with the app's own texts (messages/*.json). */
export type T = {
  (key: string, values?: Record<string, string | number>): string;
  has(key: string): boolean;
};

type Ctx = { t: T; locale: string; createdOn: string };

const photo = (storagePath: string) => fromClientPage(archiveFilePath("visit-photos", storagePath));
const document = (storagePath: string) => fromClientPage(archiveFilePath("client-documents", storagePath));

export function Page(props: { title: string; css: string; children: React.ReactNode }) {
  return (
    <html lang="ru">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex, nofollow" />
        <title>{props.title}</title>
        <link rel="stylesheet" href={props.css} />
      </head>
      <body>
        <main>{props.children}</main>
      </body>
    </html>
  );
}

/** index.html – every client A–Я with a link to her page. */
export function ArchiveIndex({ data, t }: { data: ArchiveData; t: T }) {
  const letters = [...new Set(data.clients.map((c) => indexLetter(c.card.client.fullName)))];
  return (
    <Page title={t("archive.title")} css="stil.css">
      <header className="top">
        <p className="brand">LOA</p>
        <h1>{t("archive.title")}</h1>
        <p className="muted">
          {t("archive.created", { date: formatIsoDate(data.createdOn) })} · {t("clients.count", { count: data.clients.length })}
        </p>
        <p className="muted">{t("archive.readOnly")}</p>
      </header>
      {letters.length > 1 && (
        <nav className="letters">
          {letters.map((l) => (
            <a key={l} href={`#letter-${l}`}>
              {l}
            </a>
          ))}
        </nav>
      )}
      <ul className="card list">
        {data.clients.map((c, i) => {
          const { client, age, alerts } = c.card;
          const letter = indexLetter(client.fullName);
          const first = i === 0 || indexLetter(data.clients[i - 1].card.client.fullName) !== letter;
          const last = c.visits.find((v) => !isPlanned(v, data.createdOn));
          return (
            <li key={client.id} id={first ? `letter-${letter}` : undefined}>
              <a href={clientPagePath(client.id)}>
                <span className="name">{client.fullName}</span>
                <span className="muted">
                  {[
                    age !== null ? t("clients.age", { age }) : null,
                    client.residenceCountry,
                    last ? t("archive.lastVisit", { date: formatIsoDate(last.visitDate) }) : t("visits.empty"),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
                {alerts.some((a) => a.field === "allergies") && <span className="tag alert">{t("clients.allergyTag")}</span>}
              </a>
            </li>
          );
        })}
      </ul>
      <p className="muted footer">{t("archive.created", { date: formatIsoDate(data.createdOn) })}</p>
    </Page>
  );
}

/** klienter/<id>.html – «Карта клиента» in the order of the app, everything open. */
export function ArchiveClientPage({ c, ctx }: { c: ArchiveClient; ctx: Ctx }) {
  const { t, locale, createdOn } = ctx;
  const { client, age, alerts } = c.card;
  const place = [client.residenceCountry ? countryName(client.residenceCountry, locale) : null, client.residenceCity].filter(Boolean).join(", ");
  const { general: generalPhotos, byCourse: coursePhotos } = splitClientPhotos(c.photos);
  // DK1/LE8: all documents in «Документы и анализы», the ones tied to a course also under the course.
  const courseDocuments = documentsByCourse(c.documents);
  const generalDocuments = c.documents;
  const option = (field: string, value: string) => (t.has(`karta.options.${field}.${value}`) ? t(`karta.options.${field}.${value}`) : value);

  return (
    <Page title={`${client.fullName} – ${t("card.kicker")}`} css="../stil.css">
      <p>
        <a href="../index.html" className="back">
          {t("archive.back")}
        </a>
      </p>
      <header className="top">
        <p className="kicker">{t("card.kicker")}</p>
        <h1>{client.fullName}</h1>
        <p className="muted">
          {[age !== null ? t("clients.age", { age }) : null, t("card.firstVisit", { date: formatIsoDate(client.cardDate) })]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {place && <p>{[client.residenceCountry, place].filter(Boolean).join(" · ")}</p>}
        {client.phone && <p>{client.phone}</p>}
        {client.direction.length > 0 && <p>{client.direction.map((d) => t(`direction.${d}`)).join(" · ")}</p>}
      </header>

      {alerts.length > 0 && (
        <section className="alert box">
          {alerts.map((a) => (
            <p key={a.field}>
              <b>{t(`card.fields.${a.field}`)}:</b> {a.text}
            </p>
          ))}
        </section>
      )}

      <section className="card">
        <h2>{t("visits.title")}</h2>
        {c.visits.length === 0 ? <p className="muted">{t("visits.empty")}</p> : c.visits.map((v) => <VisitBlock key={v.id} v={v} ctx={ctx} />)}
      </section>

      {generalPhotos.length > 0 && (
        <section className="card">
          <h2>{t("clientPhotos.title")}</h2>
          <PhotoTimeline photos={generalPhotos} />
        </section>
      )}

      <section className="card">
        <h2>{t("card.procedurePlan")}</h2>
        <Text value={client.procedurePlan} />
      </section>

      {(c.courses.active.length > 0 || c.courses.completed.length > 0) && (
        <section className="card">
          <h2>{t("courses.title")}</h2>
          {[...c.courses.active, ...c.courses.completed].map((k) => (
            <CourseBlock key={k.id} k={k} photos={coursePhotos[k.id] ?? []} documents={courseDocuments[k.id] ?? []} ctx={ctx} />
          ))}
        </section>
      )}

      <section className="card">
        <h2>{t("care.title")}</h2>
        {c.care.updatedAt && <p className="muted">{t("care.updated", { date: formatIsoDate(c.care.updatedAt) })}</p>}
        <Text value={c.care.text} />
        <Photos paths={c.care.photos.map((p) => p.storagePath)} />
      </section>

      <section className="card">
        <h2>{t("documents.title")}</h2>
        {generalDocuments.length === 0 ? <p className="muted">{t("documents.empty")}</p> : <DocumentList documents={generalDocuments} ctx={ctx} />}
      </section>

      <section className="card">
        <h2>{t("card.notes")}</h2>
        <Text value={client.notes} />
      </section>

      <section className="card">
        <h2>{t("card.questionnaire")}</h2>
        {client.anamnesisConfirmedAt && <p className="muted">✓ {t("card.anamnesisConfirmed", { date: formatIsoDate(client.anamnesisConfirmedAt) })}</p>}
        <h3>{t("karta.sections.generalData")}</h3>
        <dl>
          {generalDataFields.map((field) => (
            <Row
              key={field}
              label={t(`card.fields.${field}`)}
              value={
                {
                  date: formatIsoDate(client.cardDate),
                  fullName: client.fullName,
                  age: [age !== null ? t("clients.age", { age }) : null, client.birthDate ? formatIsoDate(client.birthDate) : null].filter(Boolean).join(" · "),
                  phone: client.phone,
                  email: client.email,
                  residence: place,
                  language: client.language ? t(`language.${client.language}`) : null,
                }[field]
              }
            />
          ))}
        </dl>
        {clinicalSections.map((section) => (
          <div key={section.key}>
            <h3>{t(`karta.sections.${section.key}`)}</h3>
            <dl>
              {section.fields.map((field) => (
                <Row
                  key={field.key}
                  label={t(`karta.fields.${field.key}`)}
                  value={fieldText(client.anamnesis[field.key], (v) => option(field.key, v))}
                />
              ))}
            </dl>
          </div>
        ))}
      </section>

      <p className="muted footer">{t("archive.created", { date: formatIsoDate(createdOn) })}</p>
    </Page>
  );
}

function VisitBlock({ v, ctx }: { v: Visit; ctx: Ctx }) {
  const { t, createdOn } = ctx;
  return (
    <article className="visit">
      <h3>
        {formatIsoDate(v.visitDate)}
        {isPlanned(v, createdOn) && <span className="tag"> {t("visits.planned")}</span>}
      </h3>
      {v.items.length === 0 ? (
        <p className="muted">{t("visits.noItems")}</p>
      ) : (
        <ul className="items">
          {v.items.map((i) => (
            <li key={i.id}>
              <b>{i.preparationName}</b>
              {i.quantity && ` – ${i.quantity}`}
            </li>
          ))}
        </ul>
      )}
      <Photos paths={v.photos.map((p) => p.storagePath)} label={t("visits.photos")} />
      {v.faceScheme && v.faceScheme.strokes.length > 0 && (
        <div className="scheme">
          <p className="label">{t("scheme.title")}</p>
          <FaceSchemeView scheme={v.faceScheme} label={t("scheme.title")} />
        </div>
      )}
      {v.notes && <Row label={t("visits.notes")} value={v.notes} />}
      {v.recommendations && <Row label={t("visits.recommendations")} value={v.recommendations} />}
      {v.remindOn && <p className="muted">{t("reminders.next", { date: formatIsoDate(v.remindOn) })}</p>}
      {hasArchive(v) && (
        <>
          {v.archive.homeCareRecommendations?.trim() && <Row label={`${t("visits.archive")}: ${t("visits.homeCareRecommendations")}`} value={v.archive.homeCareRecommendations} />}
          {v.archive.procedurePlan?.trim() && <Row label={`${t("visits.archive")}: ${t("visits.procedurePlan")}`} value={v.archive.procedurePlan} />}
        </>
      )}
    </article>
  );
}

function CourseBlock(props: { k: TreatmentCourse; photos: ArchiveClient["photos"]; documents: ArchiveClient["documents"]; ctx: Ctx }) {
  const { k, photos, documents, ctx } = props;
  const { t } = ctx;
  return (
    <article className="visit">
      <h3>{k.diagnosis}</h3>
      <p className="muted">
        {formatIsoDate(k.startDate)} – {formatIsoDate(k.endDate)}
        {k.status === "completed" && k.completedAt && ` · ${t("courses.completedOn", { date: formatIsoDate(k.completedAt) })}`}
      </p>
      {k.prescription && <Row label={t("courses.prescription")} value={k.prescription} />}
      {k.lastLabDate && <p className="muted">{t("courses.lastLabs", { date: formatIsoDate(k.lastLabDate) })}</p>}
      <Photos paths={k.photos.map((p) => p.storagePath)} label={t("courses.photos")} />
      {photos.length > 0 && (
        <>
          <p className="label">{t("clientPhotos.inCourse")}</p>
          <PhotoTimeline photos={photos} />
        </>
      )}
      {documents.length > 0 && (
        <>
          <p className="label">{t("courses.labDocs")}</p>
          <DocumentList documents={documents} ctx={ctx} />
        </>
      )}
    </article>
  );
}

function PhotoTimeline({ photos }: { photos: ArchiveClient["photos"] }) {
  return (
    <>
      {photoTimeline(photos).map((group) => (
        <div key={group.date}>
          <p className="label">{formatIsoDate(group.date)}</p>
          <Photos paths={group.photos.map((p) => p.storagePath)} />
        </div>
      ))}
    </>
  );
}

function Photos({ paths, label }: { paths: string[]; label?: string }) {
  if (paths.length === 0) return null;
  return (
    <>
      {label && <p className="label">{label}</p>}
      <div className="photos">
        {paths.map((p) => (
          <a key={p} href={photo(p)}>
            {/* eslint-disable-next-line @next/next/no-img-element -- static archive page, no Next image server */}
            <img src={photo(p)} alt="" />
          </a>
        ))}
      </div>
    </>
  );
}

function DocumentList({ documents, ctx }: { documents: ArchiveClient["documents"]; ctx: Ctx }) {
  const { t } = ctx;
  return (
    <ul className="docs">
      {documents.map((d) => (
        <li key={d.id}>
          <a href={document(d.storagePath)}>
            {d.title || t(d.mimeType === "application/pdf" ? "documents.pdf" : "documents.image")}
          </a>{" "}
          <span className="muted">{formatIsoDate(d.documentDate)}</span>
        </li>
      ))}
    </ul>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="row">
      <dt>{label}</dt>
      <dd>{value?.trim() ? value : "—"}</dd>
    </div>
  );
}

function Text({ value }: { value: string | null }) {
  return <p className="text">{value?.trim() ? value : "—"}</p>;
}
