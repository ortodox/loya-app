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
import type { TodayTasks } from "@/logic/rules/today-tasks";

/**
 * TD1 «Сегодня»: everything that waits – «⏰ Пора» by procedure type (N7 ✏️), appointments today and
 * tomorrow (N13 part) and birthdays (BD1). Every name opens the client's card.
 */
export async function TodayView({ clients, tasks, today }: { clients: ClientSummary[]; tasks: TodayTasks; today: IsoDate }) {
  const t = await getTranslations();
  const locale = (await getLocale()) as Locale;
  const due = dueByType(clients);
  const agenda = (["today", "tomorrow"] as const)
    .map((day) => ({ day, clients: clients.filter((c) => c.agenda === day) }))
    .filter((g) => g.clients.length > 0);
  const birthdays = clients.filter((c) => c.birthday);
  const empty =
    due.length === 0 && agenda.length === 0 && birthdays.length === 0 &&
    tasks.unpaid.length + tasks.handOver.length + tasks.needToOrder.length + tasks.stockMinus.length === 0;
  const zl = (v: number) => new Intl.NumberFormat(locale, { style: "currency", currency: "PLN", currencyDisplay: "narrowSymbol", maximumFractionDigits: 2 }).format(v);
  // UX1/UX2: red – wrong or urgent; yellow – something to do.
  const box = (tone: "red" | "yellow") =>
    `flex flex-col gap-1 rounded-[18px] border-2 p-4 ${tone === "red" ? "border-on-alert bg-alert text-on-alert" : "border-warn-line bg-warn text-on-warn"}`;
  const row = "flex min-h-11 items-center justify-between gap-3 border-t border-current/20 py-2 text-base first-of-type:border-t-0";
  const taskBox = (key: string, tone: "red" | "yellow", title: string, items: { key: string; href: string; label: string; value: string }[]) =>
    items.length > 0 && (
      <section key={key} aria-label={title} className={box(tone)}>
        <h2 className="text-lg font-semibold">{title}</h2>
        <ul className="flex flex-col">
          {items.map((i) => (
            <li key={i.key}>
              <Link href={i.href} className={row}>
                <span className="min-w-0 break-words">{i.label}</span>
                <span className="shrink-0 font-semibold">{i.value} ›</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    );

  const group = (key: string, title: string, list: ClientSummary[], strong = false, onColor = false) => (
    <div key={key} className="flex flex-col gap-1.5">
      <h3 className={`text-sm font-semibold ${onColor ? "" : "text-muted"}`}>
        {title} · {list.length}
      </h3>
      <div className="flex flex-wrap gap-2">
        {list.map((c) => (
          <Link key={c.id} href={`/clients/${c.id}`} className={`${pill.base} ${strong ? pill.on : onColor ? "border-warn-line bg-surface text-ink" : pill.off}`}>
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

      {/* UX1: what needs doing in «Магазин» and «Склад препаратов» – each line opens the order or the stock. */}
      {taskBox(
        "unpaid",
        "red",
        t("today.unpaid", { count: tasks.unpaid.length, left: zl(tasks.unpaid.reduce((s, u) => s + u.left, 0)) }),
        tasks.unpaid.map((u) => ({ key: u.orderId, href: `/shop?view=orders&new=${u.orderId}`, label: u.buyerName, value: zl(u.left) })),
      )}
      {taskBox(
        "minus",
        "red",
        t("today.stockMinus", { count: tasks.stockMinus.length }),
        tasks.stockMinus.map((s) => ({ key: s.itemId, href: "/catalog?view=stock", label: s.name, value: t(s.unit === "units" ? "today.units" : "today.pieces", { count: s.available }) })),
      )}
      {taskBox(
        "handover",
        "yellow",
        t("today.handOver", { count: tasks.handOver.length }),
        tasks.handOver.map((h) => ({ key: h.orderId, href: `/shop?view=orders&new=${h.orderId}`, label: h.ready ? h.buyerName : `${h.buyerName} · ${t("today.waitsForStock")}`, value: t("today.pieces", { count: h.pieces }) })),
      )}
      {taskBox(
        "order",
        "yellow",
        t("today.needToOrder", { count: tasks.needToOrder.length }),
        tasks.needToOrder.map((n) => ({ key: n.productId, href: "/shop?view=stock", label: `${n.name} · ${n.buyers.join(", ")}`, value: t("today.pieces", { count: n.missing }) })),
      )}

      {/* N7 ✏️: «⏰ Ботокс · 2» – names, by procedure type; «Готово» is pressed in the card. UX2: yellow – something to do. */}
      {due.length > 0 && (
        <section aria-labelledby="today-due" className="flex flex-col gap-3 rounded-[18px] border-2 border-warn-line bg-warn p-4 text-on-warn">
          <h2 id="today-due" className="font-serif text-2xl leading-tight">
            {t("today.due")}
          </h2>
          {due.map((g) =>
            group(g.type?.id ?? "none", t("reminders.dueGroup", { type: reminderTypeLabel((k) => t(`reminders.${k}`), g.type, locale) }), g.clients, false, true),
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
