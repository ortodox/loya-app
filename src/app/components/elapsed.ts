import type { Elapsed } from "@/logic/rules/botox";

type Translate = (key: "elapsedToday" | "elapsedDays" | "elapsedWeeks" | "elapsedMonths" | "elapsedMonthsWeeks", values?: Record<string, number>) => string;

/** BO1: «сегодня», «9 дн.», «3 нед.», «3 мес.», «1 мес. 2 нед.» – with the «clients» translations. */
export function elapsedText(t: Translate, e: Elapsed): string {
  if (e.unit === "days") return e.days === 0 ? t("elapsedToday") : t("elapsedDays", { count: e.days });
  if (e.unit === "weeks") return t("elapsedWeeks", { count: e.weeks });
  return e.weeks === 0 ? t("elapsedMonths", { months: e.months }) : t("elapsedMonthsWeeks", { months: e.months, weeks: e.weeks });
}
