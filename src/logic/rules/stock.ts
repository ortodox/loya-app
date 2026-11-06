import type { IsoDate } from "@/logic/client";

/** SK1: botox in vials and units (ЕД), every other preparation in pieces (one syringe per client). */
export type StockKind = "vials" | "pieces";

/** SK1 «+ Поступление»: vials of one size, or pieces; an already opened vial when stock-keeping begins. */
export type StockReceipt = {
  id: string;
  receivedOn: IsoDate;
  vialSize: number | null;
  count: number;
  openedOn: IsoDate | null;
  remaining: number | null;
  createdAt: string;
};

/** SK1 «Списать остаток» (a vial) and «Исправить остаток» (what is left). */
export type StockAdjustment = {
  happenedOn: IsoDate;
  kind: "discard" | "set";
  vialKey: string | null;
  amount: number | null;
  createdAt: string;
};

/** SK1: one use in a visit done – units or pieces; null = botox without a number (not taken off). */
export type StockUse = { date: IsoDate; amount: number | null; createdAt: string };

export type OpenVial = { key: string; size: number; openedOn: IsoDate; remaining: number };

export type StockState = {
  /** «В наличии» – what is really there. */
  available: number;
  openVials: OpenVial[];
  /** Closed vials by size, e.g. 2 × 100 ЕД. */
  closed: { size: number; count: number }[];
  /** The closed vials one by one, first received first (for «Исправить остаток»). */
  closedVials: { key: string; size: number; order: number }[];
  /** Botox uses without a number since stock-keeping began («Не указано – со склада не списано»). */
  unknown: number;
};

type Vial = { key: string; size: number; order: number; openedOn: IsoDate | null; remaining: number; gone: boolean };

type Event =
  | { date: IsoDate; rank: 0; at: string; receipt: StockReceipt }
  | { date: IsoDate; rank: 1; at: string; use: StockUse }
  | { date: IsoDate; rank: 2; at: string; adjustment: StockAdjustment };

/** SK1: receipts first on a day, then the visits, then corrections (they say what was left at the end). */
function events(receipts: readonly StockReceipt[], uses: readonly StockUse[], adjustments: readonly StockAdjustment[]): Event[] {
  return [
    ...receipts.map((receipt): Event => ({ date: receipt.receivedOn, rank: 0, at: receipt.createdAt, receipt })),
    ...uses.map((use): Event => ({ date: use.date, rank: 1, at: use.createdAt, use })),
    ...adjustments.map((adjustment): Event => ({ date: adjustment.happenedOn, rank: 2, at: adjustment.createdAt, adjustment })),
  ].sort((a, b) => a.date.localeCompare(b.date) || a.rank - b.rank || a.at.localeCompare(b.at));
}

/**
 * SK1: what is in stock, worked out from scratch every time – receipts, the visits since stock-keeping
 * began and corrections – so changing or deleting a visit is taken into account by itself.
 * Botox: units come out of the oldest opened vial; when it runs out, the next vial (first received)
 * is opened that day. Stock never goes below zero.
 */
export function simulateStock(
  kind: StockKind,
  receipts: readonly StockReceipt[],
  uses: readonly StockUse[],
  adjustments: readonly StockAdjustment[],
): StockState {
  if (kind === "pieces") {
    let available = 0;
    for (const e of events(receipts, uses, adjustments)) {
      if ("receipt" in e) available += e.receipt.count;
      else if ("use" in e) available = Math.max(0, available - (e.use.amount ?? 1));
      else if (e.adjustment.kind === "set" && e.adjustment.amount !== null) available = e.adjustment.amount;
    }
    return { available, openVials: [], closed: [], closedVials: [], unknown: 0 };
  }

  const vials: Vial[] = [];
  let order = 0;
  let unknown = 0;
  const openNext = (date: IsoDate) => {
    const next = vials.filter((v) => !v.gone && v.openedOn === null).sort((a, b) => a.order - b.order)[0];
    if (next) next.openedOn = date;
    return next ?? null;
  };
  for (const e of events(receipts, uses, adjustments)) {
    if ("receipt" in e) {
      const r = e.receipt;
      const size = r.vialSize ?? 0;
      for (let i = 0; i < r.count; i++) {
        vials.push({ key: `${r.id}:${i}`, size, order: order++, openedOn: r.openedOn, remaining: r.openedOn && r.remaining !== null ? Math.min(r.remaining, size) : size, gone: false });
      }
    } else if ("use" in e) {
      if (e.use.amount === null) {
        unknown++;
        continue;
      }
      let left = e.use.amount;
      while (left > 0) {
        const open = vials.filter((v) => !v.gone && v.openedOn !== null && v.remaining > 0).sort((a, b) => a.openedOn!.localeCompare(b.openedOn!) || a.order - b.order)[0] ?? openNext(e.date);
        if (!open) break;
        const taken = Math.min(left, open.remaining);
        open.remaining -= taken;
        left -= taken;
      }
    } else {
      const vial = vials.find((v) => v.key === e.adjustment.vialKey);
      if (!vial) continue;
      if (e.adjustment.kind === "discard") vial.gone = true;
      else if (e.adjustment.amount !== null) {
        vial.remaining = Math.min(e.adjustment.amount, vial.size);
        vial.openedOn ??= e.adjustment.happenedOn;
      }
    }
  }
  const present = vials.filter((v) => !v.gone && v.remaining > 0);
  const closed = new Map<number, number>();
  for (const v of present.filter((x) => x.openedOn === null)) closed.set(v.size, (closed.get(v.size) ?? 0) + 1);
  return {
    available: present.reduce((sum, v) => sum + v.remaining, 0),
    openVials: present
      .filter((v) => v.openedOn !== null)
      .sort((a, b) => a.openedOn!.localeCompare(b.openedOn!) || a.order - b.order)
      .map((v) => ({ key: v.key, size: v.size, openedOn: v.openedOn!, remaining: v.remaining })),
    closed: [...closed.entries()].sort((a, b) => a[0] - b[0]).map(([size, count]) => ({ size, count })),
    closedVials: present.filter((v) => v.openedOn === null).sort((a, b) => a.order - b.order).map((v) => ({ key: v.key, size: v.size, order: v.order })),
    unknown,
  };
}

/** SK1: closed vials to discard (oldest first) to bring the count of one size down to `count`. */
export function closedVialsToRemove(keys: readonly { key: string; size: number; order: number }[], size: number, count: number): string[] {
  const ofSize = keys.filter((k) => k.size === size).sort((a, b) => a.order - b.order);
  return ofSize.slice(0, Math.max(0, ofSize.length - count)).map((k) => k.key);
}

/** SK1: the vial sizes the doctor enters – positive whole units, each once, smallest first. */
export function parseVialSizes(values: readonly string[]): number[] | null {
  const sizes = [...new Set(values.map((v) => Number(v.trim())).filter((n) => Number.isInteger(n) && n > 0 && n <= 10000))].sort((a, b) => a - b);
  return sizes.length > 0 ? sizes : null;
}
