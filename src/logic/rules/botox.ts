import type { IsoDate } from "@/logic/client";
import { addMonths, daysBetween } from "./dates";

/** BO1: catalogue code of «Ботулинотерапия» – every preparation of this type counts as botox. */
export const botoxTypeCode = "BT-01";

/** BO1: the last botox injection that has taken place (planned visits after today do not count). */
export function lastBotoxDate(dates: readonly IsoDate[], today: IsoDate): IsoDate | null {
  return [...dates].filter((d) => d <= today).sort().at(-1) ?? null;
}

export type Elapsed = { unit: "days"; days: number } | { unit: "weeks"; weeks: number } | { unit: "months"; months: number; weeks: number };

/**
 * BO1: how long the botox has been in – under 2 weeks in days, under a month in weeks, then
 * whole calendar months and the remaining weeks («1 мес. 2 нед.», «3 мес.»).
 */
export function timeSince(from: IsoDate, today: IsoDate): Elapsed {
  const days = Math.max(0, daysBetween(from, today));
  let months = 0;
  while (addMonths(from, months + 1) <= today) months++;
  if (months === 0) return days < 14 ? { unit: "days", days } : { unit: "weeks", weeks: Math.floor(days / 7) };
  return { unit: "months", months, weeks: Math.floor(daysBetween(addMonths(from, months), today) / 7) };
}
