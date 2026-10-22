import type { IsoDate } from "@/logic/client";

const isoDate = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Parses `YYYY-MM-DD` into parts, or null when it is not a real calendar date. */
export function parseIsoDate(value: string): { y: number; m: number; d: number } | null {
  const match = isoDate.exec(value);
  if (!match) return null;
  const [y, m, d] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    return null;
  }
  return { y, m, d };
}

export function isIsoDate(value: string): boolean {
  return parseIsoDate(value) !== null;
}

/** Whole years from `from` to `to` (anniversary-based; 29 Feb counts on 1 Mar). Never negative. */
export function wholeYearsBetween(from: IsoDate, to: IsoDate): number {
  const a = parseIsoDate(from);
  const b = parseIsoDate(to);
  if (!a || !b) return 0;
  let years = b.y - a.y;
  if (b.m < a.m || (b.m === a.m && b.d < a.d)) years -= 1;
  return Math.max(0, years);
}

/** Today's date in the given IANA time zone as `YYYY-MM-DD`. */
export function todayIn(timeZone: string, now: Date = new Date()): IsoDate {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** CLAUDE.md: dates are shown as DD.MM.YYYY in every language. */
export function formatIsoDate(iso: IsoDate): string {
  const p = parseIsoDate(iso);
  if (!p) return iso;
  return `${String(p.d).padStart(2, "0")}.${String(p.m).padStart(2, "0")}.${p.y}`;
}
