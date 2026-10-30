import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { FaceSchemeView } from "@/app/components/face/FaceSchemeView";
import { Chevron, FaceIcon, WarningIcon } from "@/app/components/Icons";
import { card, disclosure, pill, ui } from "@/app/components/ui";
import { clinicalSections, generalDataFields, type GeneralDataField } from "@/config/kartaTemplate";
import type { IsoDate, Visit } from "@/logic/client";
import { fieldText, normalizeField, sectionHasContent, sectionPreview } from "@/logic/rules/anamnesis";
import { countryName } from "@/logic/rules/country";
import { formatIsoDate } from "@/logic/rules/dates";
import { countRecommendations } from "@/logic/rules/recommendations";
import { contactLinks } from "@/logic/rules/contacts";
import { hasArchive, isPlanned, lastCompletedVisit, splitVisits } from "@/logic/rules/visits";
import type { TreatmentCourse } from "@/logic/course";
import type { ClientCard } from "@/logic/usecases/clients";
import type { Care, ClientDocument } from "@/logic/document";
import type { ClientPhoto } from "@/logic/client-photo";
import { showsClientPhotos, splitClientPhotos } from "@/logic/rules/client-photos";
import { documentsByCourse } from "@/logic/rules/documents";
import { CareSection } from "./CareSection";
import { ClientPhotoTimeline } from "./ClientPhotoTimeline";
import { CoursesSection } from "./CoursesSection";
import { DocumentsSection } from "./DocumentsSection";

type Props = {
  data: ClientCard;
  visits: Visit[];
  /** Thumbnails of the sticker photos, by storage path. */
  photoUrls: Record<string, string>;
  /** AV1: just created – offer «Добавить визит» right away. */
  created?: boolean;
  /** VP2/RV1: visits after today are appointments. */
  today: IsoDate;
  /** LE5/LE9: treatment courses with prescription thumbnails. */
  courses: { active: TreatmentCourse[]; completed: TreatmentCourse[]; photoUrls: Record<string, string> };
  /** UH1/UH2. */
  care: { care: Care; photoUrls: Record<string, string> };
  /** DK1/DK3/LE8. */
  documents: { documents: ClientDocument[]; urls: Record<string, string> };
  /** FK1–FK4: photos the client sent – cosmetology here, course photos in «Лечение». */
  clientPhotos: { photos: ClientPhoto[]; urls: Record<string, string> };
};

export async function ClientCardView(props: Props) {
  const { data, visits, photoUrls, created = false, today, courses, care, documents, clientPhotos } = props;
  const t = await getTranslations();
  const locale = await getLocale();
  const { client, age, alerts } = data;
  const id = client.id;
  const { general: generalPhotos, byCourse: coursePhotos } = splitClientPhotos(clientPhotos.photos);
  const country = client.residenceCountry ? countryName(client.residenceCountry, locale) : null;
  const place = [country, client.residenceCity].filter(Boolean).join(", ") || null;
  const optionLabel = (field: string, option: string) =>
    t.has(`karta.options.${field}.${option}`) ? t(`karta.options.${field}.${option}`) : option;

  const general: Record<GeneralDataField, React.ReactNode> = {
    date: formatIsoDate(client.cardDate),
    fullName: client.fullName,
    age: age !== null ? t("clients.age", { age }) : null,
    phone: client.phone,
    email: client.email ? (
      <a href={`mailto:${client.email}`} className="inline-flex min-h-11 items-center break-all text-accent underline">
        {client.email}
      </a>
    ) : null,
    residence: place,
    language: client.language ? t(`language.${client.language}`) : null,
  };

  const [complaints, ...otherSections] = clinicalSections;
  const { upcoming, past } = splitVisits(visits, today);
  const repeatable = lastCompletedVisit(visits, today) !== null;

  function renderVisit(visit: Visit) {
    const planned = isPlanned(visit, today);
    const adviceCount = countRecommendations(visit.recommendations);
    return (
      <li key={visit.id} className="border-t border-line">
        {/* H1: date, preparations and number of photos; the rest when opened. */}
        <details className="group">
          <summary className={disclosure.summary}>
            <span className="flex min-w-0 flex-col">
              <span className="flex items-baseline gap-2">
                <span className="text-base font-semibold text-ink">{formatIsoDate(visit.visitDate)}</span>
                {visit.photos.length > 0 && (
                  <span className="text-sm text-muted">📷 {t("visits.photoCount", { count: visit.photos.length })}</span>
                )}
                {/* Z5: the visit has a face scheme. */}
                {visit.faceScheme && (
                  <span className="inline-flex items-center self-center text-muted">
                    <FaceIcon />
                    <span className="sr-only">{t("scheme.has")}</span>
                  </span>
                )}
              </span>
              <span className="truncate text-sm text-muted">
                {[planned ? t("visits.planned") : null, visit.items.map((i) => i.preparationName).join(", ") || null]
                  .filter(Boolean)
                  .join(" · ") || t("visits.noItems")}
              </span>
            </span>
            <Chevron className={disclosure.chevron} />
          </summary>
          <div className="flex flex-col gap-1 border-t border-line pb-3">
            {visit.items.length > 0 && (
              <ul className="flex flex-col gap-0.5 px-4 pt-2">
                {visit.items.map((item) => (
                  <li key={item.id} className="text-base text-ink">
                    {item.preparationName}
                    {item.quantity && <span className="text-muted"> · {item.quantity}</span>}
                  </li>
                ))}
              </ul>
            )}
            {visit.photos.length > 0 && (
              <ul className="flex flex-wrap gap-2 px-4 pt-2">
                {visit.photos.map((p) => (
                  <li key={p.id}>
                    {photoUrls[p.storagePath] ? (
                      <a href={photoUrls[p.storagePath]} target="_blank" rel="noreferrer" aria-label={t("visits.photos")}>
                        {/* eslint-disable-next-line @next/next/no-img-element -- signed storage URL */}
                        <img src={photoUrls[p.storagePath]} alt="" className="size-24 rounded-[14px] object-cover" />
                      </a>
                    ) : (
                      <div className="size-24 rounded-[14px] bg-line" />
                    )}
                  </li>
                ))}
              </ul>
            )}
            {/* Z5: thumbnail; tap to see it large. */}
            {visit.faceScheme && (
              <details className="group/scheme px-4 pt-2">
                <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden">
                  <FaceSchemeView scheme={visit.faceScheme} label={t("scheme.has")} className="w-20 shrink-0 border border-line group-open/scheme:hidden" />
                  <span className="text-sm font-medium text-accent">
                    <span className="group-open/scheme:hidden">{t("scheme.open")}</span>
                    <span className="hidden group-open/scheme:inline">{t("scheme.close")}</span>
                  </span>
                </summary>
                <FaceSchemeView scheme={visit.faceScheme} label={t("scheme.has")} className="mt-2 w-full border border-line" />
              </details>
            )}
            {visit.notes && (
              <dl>
                <Row label={`${t("visits.notes")} (${t("visits.notesHint")})`} value={visit.notes} plain />
              </dl>
            )}
            {/* P5: the advice is for the client – one closed line. */}
            {visit.recommendations && (
              <details className="group/advice mx-4 mt-1 rounded-[14px] border border-line">
                <summary className={`${disclosure.summary} py-2 text-sm text-ink`}>
                  <span>
                    {[
                      t("visits.adviceTitle"),
                      t("visits.adviceCount", { count: adviceCount }),
                      visit.recommendationsLang ? t(`language.${visit.recommendationsLang}`) : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                  <Chevron className="shrink-0 text-muted transition-transform group-open/advice:rotate-180" />
                </summary>
                <p className="border-t border-line px-4 py-2 text-base whitespace-pre-wrap text-ink">{visit.recommendations}</p>
              </details>
            )}
            {hasArchive(visit) && (
              <details className="group/archive mx-4 mt-1 rounded-[14px] border border-line">
                <summary className={`${disclosure.summary} py-2 text-sm text-muted`}>
                  <span>
                    {t("visits.archive")} · <span className="text-xs">{t("visits.archiveHint")}</span>
                  </span>
                  <Chevron className="shrink-0 text-muted transition-transform group-open/archive:rotate-180" />
                </summary>
                <dl className="border-t border-line">
                  {visit.archive.homeCareRecommendations?.trim() && (
                    <Row label={t("visits.homeCareRecommendations")} value={visit.archive.homeCareRecommendations} plain />
                  )}
                  {visit.archive.procedurePlan?.trim() && (
                    <Row label={t("visits.procedurePlan")} value={visit.archive.procedurePlan} plain />
                  )}
                </dl>
              </details>
            )}
            {/* VP2: when the client comes, the planned visit gets its preparations and photos. */}
            {planned ? (
              <Link href={`/clients/${id}/visits/${visit.id}/edit`} className={`${ui.addButton} mx-4 mt-2 self-start`}>
                {t("visits.complete")}
              </Link>
            ) : (
              <Link href={`/clients/${id}/visits/${visit.id}/edit`} className={`${ui.textButton} self-start px-4 text-sm`}>
                {t("visits.edit")}
              </Link>
            )}
          </div>
        </details>
      </li>
    );
  }
  const complaintsValue = normalizeField(client.anamnesis.complaints);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-5 pt-2 pb-8">
      <nav className="flex items-center justify-between">
        <Link href="/clients" className={ui.textButton}>
          ‹ {t("card.back")}
        </Link>
        <Link href={`/clients/${id}/edit`} className={ui.textButton}>
          {t("card.edit")}
        </Link>
      </nav>

      {/* AV1: after a new client is saved, the next step is usually the visit. */}
      {created && (
        <section role="status" className={`${card.surface} flex flex-col gap-3 p-4`}>
          <p className="text-base font-semibold text-ink">{t("clients.created")}</p>
          <div className="flex flex-wrap items-center gap-3">
            <Link href={`/clients/${id}/visits/new`} className={ui.addButton}>
              {t("clients.addVisit")}
            </Link>
            <Link href={`/clients/${id}`} className={ui.textButton}>
              {t("clients.later")}
            </Link>
          </div>
        </section>
      )}

      <header className="flex flex-col gap-1">
        <p className="text-xs font-semibold tracking-[0.25em] text-muted uppercase">{t("card.kicker")}</p>
        <h1 className="font-serif text-4xl leading-tight text-ink">{client.fullName}</h1>
        <p className="text-sm text-muted">
          {[age !== null ? t("clients.age", { age }) : null, t("card.firstVisit", { date: formatIsoDate(client.cardDate) })]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {/* PR5: country right under the name. */}
        {(client.residenceCountry || place) && (
          <p className="flex items-center gap-2 text-sm text-ink">
            {client.residenceCountry && <span className={ui.tag}>{client.residenceCountry}</span>}
            {place}
          </p>
        )}
        {/* DM1: cosmetology and/or dermatology. */}
        {client.direction.length > 0 && (
          <p className="flex flex-wrap gap-2 text-sm text-ink">
            {client.direction.map((d) => (
              <span key={d} className={ui.tag}>
                {t(`direction.${d}`)}
              </span>
            ))}
          </p>
        )}
        {/* KT1: call or write right from the top of the card. */}
        {client.phone && (
          <div className="pt-2">
            <PhoneLinks phone={client.phone} />
          </div>
        )}
      </header>

      {/* AL2: «Аллергоанамнез» and «Принимаемые препараты» right under the name, only when filled in. */}
      {alerts.length > 0 && (
        <section role="alert" className="flex gap-3 rounded-[18px] bg-alert p-4 text-on-alert">
          <WarningIcon className="mt-0.5" />
          <div className="flex flex-col gap-1">
            {alerts.map((a) => (
              <p key={a.field} className="whitespace-pre-wrap">
                <span className="font-semibold">{t(`card.fields.${a.field}`)}:</span> {a.text}
              </p>
            ))}
          </div>
        </section>
      )}

      {/* Loya 26.10.2026: «план процедур и визиты должны быть первыми». */}

      {/* VP2: appointments, soonest first. */}
      {upcoming.length > 0 && (
        <section className={card.surface}>
          <h2 className={`${card.heading} px-4 pt-3 pb-2`}>{t("visits.upcoming")}</h2>
          <ol>{upcoming.map((v) => renderVisit(v))}</ol>
        </section>
      )}

      {/* VS1/H1: the visits that took place, newest first. */}
      <section className={card.surface}>
        <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-2">
          <h2 className={card.heading}>{t("visits.title")}</h2>
          <Link href={`/clients/${id}/visits/new`} className={ui.addButton}>
            {t("visits.new")}
          </Link>
        </div>
        {/* RV1: same preparations and quantities as last time. */}
        {repeatable && (
          <div className="px-4 pb-3">
            <Link href={`/clients/${id}/visits/new?repeat=1`} className={`${ui.textButton} font-medium`}>
              {t("visits.repeatLast")}
            </Link>
          </div>
        )}
        {past.length === 0 ? (
          <p className={`${ui.muted} px-4 pb-4`}>{t("visits.empty")}</p>
        ) : (
          <ol>{past.map((v) => renderVisit(v))}</ol>
        )}
      </section>

      {/* FK1–FK4: cosmetology photos the client sent, by date taken (course photos are in «Лечение»). */}
      {showsClientPhotos(client.direction, generalPhotos.length) && (
        <section id="client-photos" className={`${card.surface} flex scroll-mt-4 flex-col gap-3 p-4`}>
          <div className="flex items-center justify-between gap-3">
            <h2 className={card.heading}>{t("clientPhotos.title")}</h2>
            <Link href={`/clients/${id}/photos/new`} className={ui.addButton}>
              {t("clientPhotos.add")}
            </Link>
          </div>
          {generalPhotos.length === 0 ? (
            <p className={ui.muted}>{t("clientPhotos.empty")}</p>
          ) : (
            <ClientPhotoTimeline clientId={id} photos={generalPhotos} urls={clientPhotos.urls} />
          )}
        </section>
      )}

      {/* PP1: the procedure plan belongs to the client. */}
      <section className={`${card.surface} flex flex-col gap-2 p-4`}>
        <h2 className={card.heading}>{t("card.procedurePlan")}</h2>
        <p className="min-h-6 text-base whitespace-pre-wrap">{client.procedurePlan ?? "—"}</p>
      </section>

      {/* LE5/LE9/LE8: treatment courses with their lab results. */}
      <CoursesSection
        clientId={id}
        today={today}
        {...courses}
        labDocuments={documentsByCourse(documents.documents)}
        documentUrls={documents.urls}
        clientPhotos={coursePhotos}
        clientPhotoUrls={clientPhotos.urls}
      />

      {/* UH1/UH2: home care. */}
      <CareSection clientId={id} {...care} />

      {/* DK1/DK3/DK5: documents and lab results. */}
      <DocumentsSection clientId={id} {...documents} courses={[...courses.active, ...courses.completed]} />

      {/* PR3: free notes. */}
      <section className={`${card.surface} flex flex-col gap-2 p-4`}>
        <h2 className={card.heading}>{t("card.notes")}</h2>
        <p className="min-h-6 text-base whitespace-pre-wrap">{client.notes ?? "—"}</p>
      </section>

      {/* «Анкета»: the template from Loya's note at the bottom, closed by default; each section opens. */}
      <details className={`group/anketa ${card.surface}`}>
        <summary className={disclosure.summary}>
          <span className="flex min-w-0 flex-col">
            <span className={card.heading}>{t("card.questionnaire")}</span>
            <span className="text-sm text-muted">
              {client.anamnesisConfirmedAt
                ? `✓ ${t("card.anamnesisConfirmed", { date: formatIsoDate(client.anamnesisConfirmedAt) })}`
                : t("card.questionnaireHint")}
            </span>
          </span>
          <Chevron className="shrink-0 text-muted transition-transform group-open/anketa:rotate-180" />
        </summary>
        <div className="border-t border-line">
          <details className="group border-b border-line">
            <summary className={disclosure.summary}>
              <span className="flex min-w-0 flex-col">
                <span className="font-serif text-xl text-ink">{t("karta.sections.generalData")}</span>
                <span className="truncate text-sm text-muted">
                  {[formatIsoDate(client.cardDate), client.phone, client.email, place, general.language].filter(Boolean).join(" · ")}
                </span>
              </span>
              <Chevron className={disclosure.chevron} />
            </summary>
            <dl className="border-t border-line">
              {generalDataFields.map((field) => (
                <Row key={field} label={t(`card.fields.${field}`)} value={general[field]} />
              ))}
            </dl>
          </details>

          {/* JA1: complaints as pills, chosen ones filled. */}
          <details className="group border-b border-line">
            <summary className={disclosure.summary}>
              <span className="flex min-w-0 flex-col">
                <span className="font-serif text-xl text-ink">{t(`karta.sections.${complaints.key}`)}</span>
                <span className="truncate text-sm text-muted">
                  {sectionHasContent(complaints.fields, client.anamnesis)
                    ? sectionPreview(complaints.fields, client.anamnesis, optionLabel)
                    : t("karta.emptyCount")}
                </span>
              </span>
              <Chevron className={disclosure.chevron} />
            </summary>
            <div className="flex flex-col gap-3 border-t border-line p-4">
              <ul className="flex flex-wrap gap-2">
                {complaints.fields[0].options.map((option) => {
                  const on = complaintsValue.choices.includes(option);
                  return (
                    <li key={option} className={`${pill.base} ${on ? pill.on : pill.off}`}>
                      {on && <span aria-hidden>✓</span>}
                      <span className={on ? "" : "opacity-80"}>{optionLabel("complaints", option)}</span>
                      {on && <span className="sr-only">({t("karta.selected")})</span>}
                    </li>
                  );
                })}
              </ul>
              {complaintsValue.text && <p className="whitespace-pre-wrap text-base">{complaintsValue.text}</p>}
            </div>
          </details>

          {/* AN1, SK1, VI1, PH1: rows that open, with a short summary under the title. */}
          {otherSections.map((section) => {
            const filled = sectionHasContent(section.fields, client.anamnesis);
            const preview = sectionPreview(section.fields, client.anamnesis, optionLabel);
            return (
              <details key={section.key} className="group border-b border-line last:border-b-0">
                <summary className={disclosure.summary}>
                  <span className="flex min-w-0 flex-col">
                    <span className="font-serif text-xl text-ink">{t(`karta.sections.${section.key}`)}</span>
                    <span className="truncate text-sm text-muted">{filled ? preview : t("karta.emptyCount")}</span>
                  </span>
                  <Chevron className={disclosure.chevron} />
                </summary>
                <dl className="border-t border-line">
                  {section.fields.map((field) => (
                    <Row
                      key={field.key}
                      label={t(`karta.fields.${field.key}`)}
                      value={fieldText(client.anamnesis[field.key], (c) => optionLabel(field.key, c)) || null}
                    />
                  ))}
                </dl>
              </details>
            );
          })}
        </div>
      </details>
    </main>
  );
}

function Row(props: { label: string; value: React.ReactNode; plain?: boolean }) {
  const { label, value, plain } = props;
  return (
    <div className={plain ? "flex flex-col gap-0.5 px-4 py-2 last:pb-3" : card.row}>
      <dt className={card.label}>{label}</dt>
      <dd className="text-base whitespace-pre-wrap text-ink">{value ?? "—"}</dd>
    </div>
  );
}

/** KT1: the phone number with «Позвонить», WhatsApp, Telegram and Viber. */
async function PhoneLinks({ phone }: { phone: string }) {
  const t = await getTranslations("card");
  const links = contactLinks(phone);
  if (!links) return <span>{phone}</span>;
  const button =
    "inline-flex min-h-11 items-center justify-center rounded-[14px] border border-field px-1 text-sm font-medium text-accent";
  return (
    <span className="flex flex-col gap-2">
      <span className="text-base text-ink">{phone}</span>
      <span className="grid grid-cols-4 gap-1.5">
        <a href={links.call} className={button}>
          {t("call")}
        </a>
        <a href={links.whatsapp} target="_blank" rel="noreferrer" className={button}>
          {t("whatsapp")}
        </a>
        <a href={links.telegram} target="_blank" rel="noreferrer" className={button}>
          {t("telegram")}
        </a>
        <a href={links.viber} className={button}>
          {t("viber")}
        </a>
      </span>
    </span>
  );
}
