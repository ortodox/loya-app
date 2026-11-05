import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { BrandMark } from "@/app/components/Brand";
import { reminderTypeLabel } from "@/app/components/reminderType";
import { card, pill, ui } from "@/app/components/ui";
import type { Locale } from "@/config/locales";
import type { IsoDate } from "@/logic/client";
import { formatIsoDate } from "@/logic/rules/dates";
import { dueByType } from "@/logic/rules/reminders";
import type { ClientSummary } from "@/logic/usecases/clients";

/**
 * TD1 «Сегодня»: everything that waits – «⏰ Пора» by procedure type (N7 ✏️), appointments today and
 * tomorrow (N13 part) and birthdays (BD1). Every name opens the client's card.
 */
export async function TodayView({ clients, today }: { clients: ClientSummary[]; today: IsoDate }) {
  const t = await getTranslations();
  const locale = (await getLocale()) as Locale;
  const due = dueByType(clients);
  const agenda = (["today", "tomorrow"] as const)
    .map((day) => ({ day, clients: clients.filter((c) => c.agenda === day) }))
    .filter((g) => g.clients.length > 0);
  const birthdays = clients.filter((c) => c.birthday);
  const empty = due.length === 0 && agenda.length === 0 && birthdays.length === 0;

  const group = (key: string, title: string, list: ClientSummary[], strong = false) => (
    <div key={key} className="flex flex-col gap-1.5">
      <h3 className="text-sm font-semibold text-muted">
        {title} · {list.length}
      </h3>
      <div className="flex flex-wrap gap-2">
        {list.map((c) => (
          <Link key={c.id} href={`/clients/${c.id}`} className={`${pill.base} ${strong ? pill.on : pill.off}`}>
            {c.fullName}
          </Link>
        ))}
      </div>
    </div>
  );

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-5 pt-4 pb-6">
      <header className="flex items-center justify-between gap-4">
        <BrandMark />
      </header>
      <div>
        <h1 className="font-serif text-5xl leading-tight text-ink">{t("today.title")}</h1>
        <p className={ui.muted}>{formatIsoDate(today)}</p>
      </div>

      {empty && <p className={`${card.surface} px-5 py-10 text-center ${ui.muted}`}>{t("today.empty")}</p>}

      {/* N7 ✏️: «⏰ Ботокс · 2» – names, by procedure type; «Готово» is pressed in the card. */}
      {due.length > 0 && (
        <section aria-labelledby="today-due" className={`${card.surface} flex flex-col gap-3 p-4`}>
          <h2 id="today-due" className={card.heading}>
            {t("today.due")}
          </h2>
          {due.map((g) =>
            group(g.type?.id ?? "none", t("reminders.dueGroup", { type: reminderTypeLabel((k) => t(`reminders.${k}`), g.type, locale) }), g.clients),
          )}
        </section>
      )}

      {/* N13 (part): appointments today and tomorrow. */}
      {agenda.length > 0 && (
        <section aria-labelledby="today-agenda" className={`${card.surface} flex flex-col gap-3 p-4`}>
          <h2 id="today-agenda" className={card.heading}>
            {t("today.agenda")}
          </h2>
          {agenda.map((g) => group(g.day, t(`clients.${g.day}`), g.clients, g.day === "today"))}
        </section>
      )}

      {/* BD1: birthdays today. */}
      {birthdays.length > 0 && (
        <section aria-labelledby="today-birthdays" className={`${card.surface} flex flex-col gap-3 p-4`}>
          <h2 id="today-birthdays" className={card.heading}>
            {t("today.birthdays")}
          </h2>
          {group("birthdays", t("birthday.group"), birthdays)}
        </section>
      )}
    </main>
  );
}
