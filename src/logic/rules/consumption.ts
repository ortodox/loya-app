import type { IsoDate } from "@/logic/client";
import { botoxTypeCode } from "./botox";
import type { ReminderType } from "./reminders";

/** RS1: one preparation of a visit, as the consumption needs it. */
export type ConsumptionItem = {
  /** The catalogue preparation, or the name when it was added by hand. */
  key: string;
  name: string;
  type: ReminderType | null;
  quantity: string | null;
};

/** RS1: a visit (done or planned) with its preparations and an open reminder, if any. */
export type ConsumptionVisit = {
  clientId: string;
  visitDate: IsoDate;
  /** N7: an open reminder (not «Готово») set in this visit. */
  remindOn: IsoDate | null;
  items: ConsumptionItem[];
};

/** RS1: «ЕД» for botulinum therapy (all its preparations), «шт» – one syringe per client – for the rest. */
export type ConsumptionUnit = "units" | "pieces";

export type ConsumptionRow = {
  key: string;
  name: string;
  unit: ConsumptionUnit;
  /** Units (botox) or pieces; botox rows without a number are not in the sum. */
  amount: number;
  /** Botox rows whose quantity could not be read («N записей без числа»). */
  unknown: number;
};

export type ConsumptionGroup = { type: ReminderType | null; rows: ConsumptionRow[] };

export type Consumption = {
  month: string;
  used: ConsumptionGroup[];
  usedVisits: number;
  /** For the following month – only when the month shown is the current one. */
  forecast: ConsumptionGroup[] | null;
  forecastVisits: number;
};

export const isBotox = (type: ReminderType | null) => type?.code === botoxTypeCode;

const amount = /^(\d+(?:[.,]\d+)?)(?:\s*\+\s*(\d+(?:[.,]\d+)?))*\s*(?:ед|u|ui|units?)?\.?$/i;
const number = (s: string) => Number(s.replace(",", "."));

/** RS1: botox units from the free-text quantity – «20» → 20, «20+15 ед.» → 35; null when it cannot be read. */
export function botoxUnits(quantity: string | null): number | null {
  const text = (quantity ?? "").trim().toLowerCase();
  if (!amount.test(text)) return null;
  return text
    .replace(/[^\d.,+]/g, "")
    .split("+")
    .filter(Boolean)
    .reduce((sum, part) => sum + number(part), 0);
}

/** RS1: pieces for other preparations – one syringe per client, or the number written («2», «2 шт»). */
export function pieces(quantity: string | null): number {
  const m = /^(\d+)\s*(?:шт|шпр\w*)?\.?$/i.exec((quantity ?? "").trim());
  return m && Number(m[1]) > 0 ? Number(m[1]) : 1;
}

/** RS1: «2026-11» – the month of a date, and the month after. */
export const monthOf = (date: IsoDate) => date.slice(0, 7);
export function nextMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}
export function previousMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}
export const isMonth = (value: string | undefined): value is string => !!value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);

type Line = { item: ConsumptionItem; amount: number | null };

function lineOf(item: ConsumptionItem, fallback: string | null): Line {
  if (!isBotox(item.type)) return { item, amount: pieces(item.quantity) };
  return { item, amount: botoxUnits(item.quantity) ?? botoxUnits(fallback) };
}

function group(lines: readonly Line[]): ConsumptionGroup[] {
  const byType = new Map<string, { type: ReminderType | null; rows: Map<string, ConsumptionRow> }>();
  for (const { item, amount: value } of lines) {
    const typeKey = item.type?.id ?? "none";
    const g = byType.get(typeKey) ?? { type: item.type, rows: new Map() };
    const row = g.rows.get(item.key) ?? { key: item.key, name: item.name, unit: isBotox(item.type) ? "units" : "pieces", amount: 0, unknown: 0 };
    if (value === null) row.unknown++;
    else row.amount += value;
    g.rows.set(item.key, row);
    byType.set(typeKey, g);
  }
  const rank = (t: ReminderType | null) => (t === null ? "3" : t.code ? `1${t.code}` : `2${t.name.ru ?? ""}`);
  return [...byType.values()]
    .sort((a, b) => rank(a.type).localeCompare(rank(b.type)))
    .map((g) => ({ type: g.type, rows: [...g.rows.values()].sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name, "ru")) }));
}

/**
 * RS1 «Расход»: what was used in the month (visits done by today) and, for the current month, what
 * is likely needed in the next one – planned visits (their preparations, otherwise the client's last
 * visit) and open «⏰ Пора» reminders (the preparations of the visit they were set in), each client's
 * reminder only when she has no planned visit that month. A botox quantity that cannot be read takes
 * the client's last readable quantity of the same preparation («как в прошлый раз»). No client names.
 */
export function consumption(visits: readonly ConsumptionVisit[], month: string, today: IsoDate): Consumption {
  const done = visits.filter((v) => v.visitDate <= today).sort((a, b) => a.visitDate.localeCompare(b.visitDate));
  const lastQuantity = (clientId: string, key: string): string | null => {
    for (let i = done.length - 1; i >= 0; i--) {
      if (done[i].clientId !== clientId) continue;
      const item = done[i].items.find((x) => x.key === key && botoxUnits(x.quantity) !== null);
      if (item) return item.quantity;
    }
    return null;
  };
  const lastItems = (clientId: string) => [...done].reverse().find((v) => v.clientId === clientId && v.items.length > 0)?.items ?? [];

  const usedVisits = done.filter((v) => monthOf(v.visitDate) === month && v.items.length > 0);
  const used = group(usedVisits.flatMap((v) => v.items.map((i) => lineOf(i, null))));

  if (month !== monthOf(today)) return { month, used, usedVisits: usedVisits.length, forecast: null, forecastVisits: 0 };

  const next = nextMonth(month);
  const planned = visits.filter((v) => v.visitDate > today && monthOf(v.visitDate) === next);
  const withPlanned = new Set(planned.map((v) => v.clientId));
  const reminders = visits.filter((v) => v.remindOn !== null && monthOf(v.remindOn) === next && !withPlanned.has(v.clientId));
  const expected = [
    ...planned.map((v) => ({ clientId: v.clientId, items: v.items.length > 0 ? v.items : lastItems(v.clientId) })),
    ...reminders.map((v) => ({ clientId: v.clientId, items: v.items })),
  ].filter((e) => e.items.length > 0);
  const forecast = group(expected.flatMap((e) => e.items.map((i) => lineOf(i, lastQuantity(e.clientId, i.key)))));
  return { month, used, usedVisits: usedVisits.length, forecast, forecastVisits: expected.length };
}
