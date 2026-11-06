import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { BrandMark } from "@/app/components/Brand";
import { reminderTypeLabel } from "@/app/components/reminderType";
import { card, ui } from "@/app/components/ui";
import type { Locale } from "@/config/locales";
import { nextMonth, previousMonth, type Consumption, type ConsumptionGroup, type ConsumptionUnit } from "@/logic/rules/consumption";
import type { ReminderType } from "@/logic/rules/reminders";
import { CatalogSwitch } from "./CatalogSwitch";

type Merged = { name: string; unit: ConsumptionUnit; used: number; usedUnknown: number; forecast: number | null; forecastUnknown: number };

/** RS1: one list per type – used in the month and, for the current month, «→ ~» what the next one needs. */
function merge(used: ConsumptionGroup[], forecast: ConsumptionGroup[] | null) {
  const groups = new Map<string, { type: ReminderType | null; rows: Map<string, Merged> }>();
  const add = (list: ConsumptionGroup[], which: "used" | "forecast") => {
    for (const g of list) {
      const key = g.type?.id ?? "none";
      const group = groups.get(key) ?? { type: g.type, rows: new Map<string, Merged>() };
      for (const r of g.rows) {
        const row = group.rows.get(r.key) ?? { name: r.name, unit: r.unit, used: 0, usedUnknown: 0, forecast: forecast ? 0 : null, forecastUnknown: 0 };
        if (which === "used") {
          row.used += r.amount;
          row.usedUnknown += r.unknown;
        } else {
          row.forecast = (row.forecast ?? 0) + r.amount;
          row.forecastUnknown += r.unknown;
        }
        group.rows.set(r.key, row);
      }
      groups.set(key, group);
    }
  };
  add(used, "used");
  if (forecast) add(forecast, "forecast");
  return [...groups.values()];
}

export async function ConsumptionView({ data, current }: { data: Consumption; current: string }) {
  const t = await getTranslations();
  const locale = (await getLocale()) as Locale;
  const monthName = (month: string) => {
    const [y, m] = month.split("-").map(Number);
    const name = new Intl.DateTimeFormat(locale, { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 1)));
    return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${y}`;
  };
  const unit = (u: ConsumptionUnit) => t(u === "units" ? "consumption.units" : "consumption.pieces");
  const fmt = (n: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(n);
  const groups = merge(data.used, data.forecast);
  const empty = groups.length === 0;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-5 pt-2 pb-8">
      <header className="flex items-center justify-between gap-4 pt-2">
        <BrandMark />
        <Link href="/catalog/preparations/new" className={ui.addButton}>
          {t("catalog.newPreparation")}
        </Link>
      </header>
      <h1 className="font-serif text-5xl leading-tight text-ink">{t("catalog.title")}</h1>
      <CatalogSwitch current="usage" />

      {/* Month: back in time, never past the current month. */}
      <nav aria-label={t("consumption.monthLabel")} className="flex items-center justify-between gap-2">
        <Link href={`/catalog?view=usage&month=${previousMonth(data.month)}`} className={`${ui.textButton} px-3 text-2xl`} aria-label={t("consumption.previous")}>
          ‹
        </Link>
        <h2 className="font-serif text-2xl text-ink">{monthName(data.month)}</h2>
        {data.month < current ? (
          <Link href={`/catalog?view=usage&month=${nextMonth(data.month)}`} className={`${ui.textButton} px-3 text-2xl`} aria-label={t("consumption.next")}>
            ›
          </Link>
        ) : (
          <span aria-hidden className="min-h-11 px-3" />
        )}
      </nav>

      <section className={`${card.surface} grid grid-cols-2 gap-3 p-4`}>
        <div className="flex flex-col">
          <span className={ui.muted}>{t("consumption.used")}</span>
          <span className="text-xl font-semibold text-ink">{t("consumption.visits", { count: data.usedVisits })}</span>
        </div>
        {data.forecast && (
          <div className="flex flex-col">
            <span className={ui.muted}>{t("consumption.expected", { month: monthName(nextMonth(data.month)) })}</span>
            <span className="text-xl font-semibold text-ink">~{t("consumption.visits", { count: data.forecastVisits })}</span>
          </div>
        )}
      </section>

      {empty && <p className={`${card.surface} px-5 py-10 text-center ${ui.muted}`}>{t("consumption.empty")}</p>}

      {groups.map((g) => (
        <section key={g.type?.id ?? "none"} className="flex flex-col gap-2">
          <h3 className="px-1 text-sm font-semibold text-muted">{reminderTypeLabel((k) => t(`reminders.${k}`), g.type, locale)}</h3>
          <ul className={`${card.surface} flex flex-col`}>
            {[...g.rows.values()].map((r) => (
              <li key={r.name} className="flex items-baseline justify-between gap-3 border-b border-line px-4 py-3 last:border-b-0">
                <span className="min-w-0 truncate text-base font-semibold text-ink">{r.name}</span>
                <span className="flex shrink-0 flex-col items-end text-right">
                  <span className="text-base text-ink">
                    {fmt(r.used)} {unit(r.unit)}
                    {r.forecast !== null && (
                      <span className="text-muted">
                        {" "}→ ~{fmt(r.forecast)} {unit(r.unit)}
                      </span>
                    )}
                  </span>
                  {r.usedUnknown + r.forecastUnknown > 0 && (
                    <span className="text-xs text-on-alert">{t("consumption.unknown", { count: r.usedUnknown + r.forecastUnknown })}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {data.forecast && <p className="text-xs text-muted">{t("consumption.hint")}</p>}
    </main>
  );
}
