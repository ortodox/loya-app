import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { Chevron, WarningIcon } from "@/app/components/Icons";
import { card, disclosure, pill, ui } from "@/app/components/ui";
import { clinicalSections, generalDataFields, type GeneralDataField } from "@/config/kartaTemplate";
import type { Visit } from "@/logic/client";
import { fieldText, normalizeField, sectionHasContent, sectionPreview } from "@/logic/rules/anamnesis";
import { countryName } from "@/logic/rules/country";
import { formatIsoDate } from "@/logic/rules/dates";
import type { ClientCard } from "@/logic/usecases/clients";

export async function ClientCardView({ data, visits }: { data: ClientCard; visits: Visit[] }) {
  const t = await getTranslations();
  const locale = await getLocale();
  const { client, age, alerts } = data;
  const id = client.id;
  const country = client.residenceCountry ? countryName(client.residenceCountry, locale) : null;
  const place = [country, client.residenceCity].filter(Boolean).join(", ") || null;
  const optionLabel = (field: string, option: string) =>
    t.has(`karta.options.${field}.${option}`) ? t(`karta.options.${field}.${option}`) : option;

  const general: Record<GeneralDataField, React.ReactNode> = {
    date: formatIsoDate(client.cardDate),
    fullName: client.fullName,
    age: age !== null ? t("clients.age", { age }) : null,
    phone: client.phone ? (
      <a href={`tel:${client.phone.replace(/[^\d+]/g, "")}`} className="inline-flex min-h-11 items-center text-accent underline">
        {client.phone}
      </a>
    ) : null,
    email: client.email ? (
      <a href={`mailto:${client.email}`} className="inline-flex min-h-11 items-center break-all text-accent underline">
        {client.email}
      </a>
    ) : null,
    residence: place,
    language: client.language ? t(`language.${client.language}`) : null,
  };

  const [complaints, ...otherSections] = clinicalSections;
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
      </header>

      {/* AL2: «Аллергоанамнез» and «Принимаемые препараты» first, only when filled in. */}
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

      <section className={card.surface}>
        <h2 className={`${card.heading} px-4 pt-4 pb-1`}>{t("karta.sections.generalData")}</h2>
        <dl>
          {generalDataFields.map((field) => (
            <Row key={field} label={t(`card.fields.${field}`)} value={general[field]} />
          ))}
        </dl>
      </section>

      {/* JA1: complaints as pills, chosen ones filled. */}
      <section className={`${card.surface} flex flex-col gap-3 p-4`}>
        <h2 className={card.heading}>{t(`karta.sections.${complaints.key}`)}</h2>
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
      </section>

      {/* AN1, SK1, VI1, PH1: rows that open, with a short summary under the title. */}
      <section className={card.surface}>
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
      </section>

      {/* VS1: visits under the template and above the notes, newest first. */}
      <section className={card.surface}>
        <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-2">
          <h2 className={card.heading}>{t("visits.title")}</h2>
          <Link
            href={`/clients/${id}/visits/new`}
            className="inline-flex min-h-11 items-center rounded-full bg-primary px-4 text-sm font-semibold text-on-primary"
          >
            {t("visits.new")}
          </Link>
        </div>
        {visits.length === 0 ? (
          <p className={`${ui.muted} px-4 pb-4`}>{t("visits.empty")}</p>
        ) : (
          <ol>
            {visits.map((visit) => (
              <li key={visit.id} className="border-t border-line">
                <div className="flex items-center justify-between gap-3 px-4 pt-2">
                  <span className="text-base font-semibold">{formatIsoDate(visit.visitDate)}</span>
                  <Link href={`/clients/${id}/visits/${visit.id}/edit`} className={`${ui.textButton} text-sm`}>
                    {t("visits.edit")}
                  </Link>
                </div>
                <dl>
                  <Row label={t("visits.homeCareRecommendations")} value={visit.homeCareRecommendations} plain />
                  <Row label={t("visits.procedurePlan")} value={visit.procedurePlan} plain />
                </dl>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* PR3: free notes at the bottom, as in Notes. */}
      <section className={`${card.surface} flex flex-col gap-2 p-4`}>
        <h2 className={card.heading}>{t("card.notes")}</h2>
        <p className="min-h-6 text-base whitespace-pre-wrap">{client.notes ?? "—"}</p>
      </section>
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
