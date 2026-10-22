import { getFormatter, getTranslations } from "next-intl/server";
import Link from "next/link";
import { dateFormat, isoToDate } from "@/app/components/format";
import { card as cardUi } from "@/app/components/ui";
import { cardSection1, type CardSection1Field } from "@/config/card-template";
import { fieldText } from "@/logic/rules/safety-alert";
import type { ClientCard } from "@/logic/usecases/clients";

export async function ClientCardView({ data }: { data: ClientCard }) {
  const t = await getTranslations();
  const format = await getFormatter();
  const { client, age, alerts } = data;
  const id = client.id;

  const values: Record<CardSection1Field, React.ReactNode> = {
    date: format.dateTime(isoToDate(client.cardDate), dateFormat),
    fullName: client.fullName,
    age: age !== null ? t("clients.age", { age }) : null,
    phone: client.phone ? (
      <a href={`tel:${client.phone.replace(/[^\d+]/g, "")}`} className="underline">
        {client.phone}
      </a>
    ) : null,
    language: client.language ? t(`language.${client.language}`) : null,
    complaints: fieldText(client.complaints) || null,
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

      <h1 className="text-2xl font-bold">{client.fullName}</h1>

      {/* AL2: allergies and medications first, only when recorded. */}
      {alerts.length > 0 && (
        <section
          role="alert"
          className="flex flex-col gap-2 rounded-2xl border border-red-300 bg-red-50 p-4 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100"
        >
          <h2 className="text-sm font-semibold tracking-wide uppercase">⚠ {t("card.alertTitle")}</h2>
          {alerts.map((a) => (
            <p key={a.field}>
              <span className="font-semibold">{t(`card.fields.${a.field}`)}:</span> {a.text}
            </p>
          ))}
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className={`${cardUi.label} px-1 font-semibold`}>{t("card.title")}</h2>
        <dl className={cardUi.section}>
          {cardSection1.map((field) => (
            <div key={field} className={cardUi.row}>
              <dt className={cardUi.label}>{t(`card.fields.${field}`)}</dt>
              <dd className="text-base">{values[field] ?? "—"}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* PR3: free notes at the bottom, as in Notes. */}
      <section className="flex flex-col gap-2">
        <h2 className={`${cardUi.label} px-1 font-semibold`}>{t("card.notes")}</h2>
        <div className={`${cardUi.section} min-h-16 px-4 py-3 text-base whitespace-pre-wrap`}>
          {client.notes ?? "—"}
        </div>
      </section>
    </main>
  );
}
