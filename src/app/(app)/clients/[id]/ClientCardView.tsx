import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { card as cardUi, sectionSummary } from "@/app/components/ui";
import { clinicalSections, generalDataFields, type GeneralDataField } from "@/config/kartaTemplate";
import { fieldText, sectionHasContent } from "@/logic/rules/anamnesis";
import { countryName, flagEmoji } from "@/logic/rules/country";
import { formatIsoDate } from "@/logic/rules/dates";
import type { Visit } from "@/logic/client";
import type { ClientCard } from "@/logic/usecases/clients";

export async function ClientCardView({ data, visits }: { data: ClientCard; visits: Visit[] }) {
  const t = await getTranslations();
  const locale = await getLocale();
  const { client, age, alerts } = data;
  const id = client.id;
  const country = client.residenceCountry
    ? `${flagEmoji(client.residenceCountry)} ${countryName(client.residenceCountry, locale)}`
    : null;
  const residence = [country, client.residenceCity].filter(Boolean).join(", ") || null;

  const general: Record<GeneralDataField, React.ReactNode> = {
    date: formatIsoDate(client.cardDate),
    fullName: client.fullName,
    age: age !== null ? t("clients.age", { age }) : null,
    phone: client.phone ? (
      <a href={`tel:${client.phone.replace(/[^\d+]/g, "")}`} className="underline">
        {client.phone}
      </a>
    ) : null,
    email: client.email ? (
      <a href={`mailto:${client.email}`} className="break-all underline">
        {client.email}
      </a>
    ) : null,
    residence,
    language: client.language ? t(`language.${client.language}`) : null,
  };

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-5 py-6">
      <nav className="flex items-center justify-between">
        <Link href="/clients" className="text-base text-neutral-500 dark:text-neutral-400">
          ‹ {t("card.back")}
        </Link>
        <Link href={`/clients/${id}/edit`} className="text-base font-semibold">
          {t("card.edit")}
        </Link>
      </nav>

      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">{client.fullName}</h1>
        {/* PR5: country of residence right under the name. */}
        {residence && <p className="text-base text-neutral-600 dark:text-neutral-300">{residence}</p>}
      </header>

      {/* AL2: «Аллергоанамнез» and «Принимаемые препараты» first, only when filled in. */}
      {alerts.length > 0 && (
        <section
          role="alert"
          className="flex flex-col gap-2 rounded-2xl border border-red-300 bg-red-50 p-4 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100"
        >
          <h2 className="text-sm font-semibold tracking-wide uppercase">⚠ {t("card.alertTitle")}</h2>
          {alerts.map((a) => (
            <p key={a.field} className="whitespace-pre-wrap">
              <span className="font-semibold">{t(`card.fields.${a.field}`)}:</span> {a.text}
            </p>
          ))}
        </section>
      )}

      <Section title={t("karta.sections.generalData")} open>
        <dl className={cardUi.section}>
          {generalDataFields.map((field) => (
            <Row key={field} label={t(`card.fields.${field}`)} value={general[field]} />
          ))}
        </dl>
      </Section>

      {clinicalSections.map((section) => {
        const filled = sectionHasContent(section.fields, client.anamnesis);
        return (
          <Section
            key={section.key}
            title={t(`karta.sections.${section.key}`)}
            hint={filled ? undefined : t("karta.emptyCount")}
            open={filled}
          >
            <dl className={cardUi.section}>
              {section.fields.map((field) => {
                const label = (option: string) =>
                  t.has(`karta.options.${field.key}.${option}`)
                    ? t(`karta.options.${field.key}.${option}`)
                    : option;
                return (
                  <Row
                    key={field.key}
                    label={t(`karta.fields.${field.key}`)}
                    // A section with one field of the same name (Жалобы) needs no second label.
                    hideLabel={section.fields.length === 1 && field.key === section.key}
                    value={fieldText(client.anamnesis[field.key], label) || null}
                  />
                );
              })}
            </dl>
          </Section>
        );
      })}

      {/* VS1: visits under the template and above the notes, newest first. */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{t("visits.title")}</h2>
          <Link
            href={`/clients/${id}/visits/new`}
            className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-neutral-100 dark:text-neutral-900"
          >
            {t("visits.new")}
          </Link>
        </div>
        {visits.length === 0 ? (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">{t("visits.empty")}</p>
        ) : (
          <ol className="flex flex-col gap-3">
            {visits.map((visit) => (
              <li key={visit.id} className={cardUi.section}>
                <div className="flex items-center justify-between gap-3 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
                  <span className="text-base font-semibold">{formatIsoDate(visit.visitDate)}</span>
                  <Link
                    href={`/clients/${id}/visits/${visit.id}/edit`}
                    className="text-sm text-neutral-500 dark:text-neutral-400"
                  >
                    {t("visits.edit")}
                  </Link>
                </div>
                <dl>
                  <Row label={t("visits.homeCareRecommendations")} value={visit.homeCareRecommendations} />
                  <Row label={t("visits.procedurePlan")} value={visit.procedurePlan} />
                </dl>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* PR3: free notes at the bottom, as in Notes. */}
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{t("card.notes")}</h2>
        <div className={`${cardUi.section} min-h-16 px-4 py-3 text-base whitespace-pre-wrap`}>
          {client.notes ?? "—"}
        </div>
      </section>
    </main>
  );
}

function Section(props: { title: string; hint?: string; open?: boolean; children: React.ReactNode }) {
  return (
    <details open={props.open} className="group flex flex-col gap-2">
      <summary className={sectionSummary}>
        <span className="flex items-baseline gap-2">
          {props.title}
          {props.hint && (
            <span className="text-sm font-normal whitespace-nowrap text-neutral-400 dark:text-neutral-500">
              {props.hint}
            </span>
          )}
        </span>
      </summary>
      <div className="pt-2">{props.children}</div>
    </details>
  );
}

function Row(props: { label: string; hideLabel?: boolean; value: React.ReactNode }) {
  const { label, hideLabel, value } = props;
  return (
    <div className={cardUi.row}>
      <dt className={hideLabel ? "sr-only" : cardUi.label}>{label}</dt>
      <dd className="text-base whitespace-pre-wrap">{value ?? "—"}</dd>
    </div>
  );
}
