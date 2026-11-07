import type { IsoDate } from "@/logic/client";
import { todayIn } from "./dates";
import type { StockHistoryEntry } from "./stock";

/** SK4: one row of the change log, written by the database (migration 20261109000000_stock_changes.sql). */
export type StockChange = {
  at: string;
  source: "visit_item" | "visit" | "receipt" | "adjustment";
  action: "insert" | "update" | "delete";
  visitId: string | null;
  visitDate: IsoDate | null;
  newVisitDate: IsoDate | null;
  oldQuantity: string | null;
  newQuantity: string | null;
  /** Receipts and corrections: the date of the row that was changed or deleted. */
  rowDate: IsoDate | null;
};

/** SK4: a line of «История» saying what was changed, when (date and time) and from → to. */
export type StockChangeLine = {
  date: IsoDate;
  time: string;
  kind: "visitChanged" | "visitAdded" | "visitRemoved" | "visitDate" | "visitDeleted" | "receiptChanged" | "receiptDeleted" | "correctionChanged" | "correctionDeleted";
  /** The visit's (or receipt's, correction's) own date. */
  of: IsoDate | null;
  /** «20» → «25» (quantities as typed), or dates for a date change. */
  from: string | null;
  to: string | null;
};

/** A save of a visit replaces its rows (delete + insert) – changes of one visit this close belong together. */
const sameSave = 2 * 60 * 1000;

const sorted = (values: (string | null)[]) => values.map((v) => (v ?? "").trim()).sort();
const joined = (values: (string | null)[]) => sorted(values).filter(Boolean).join(" + ") || null;

/**
 * SK4: turns the raw change log into lines for «История», newest first. The rows of one save of a
 * visit are put together: «20» removed and «25» added is «Изменение визита 20 → 25»; the same
 * quantity removed and added again (the visit was saved for another reason) is no change at all.
 * A visit entered on a later day than its date shows as «внесён задним числом».
 */
export function summarizeChanges(changes: readonly StockChange[], timeZone: string): StockChangeLine[] {
  const when = (at: string) => {
    const instant = new Date(at);
    const time = new Intl.DateTimeFormat("ru-RU", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(instant);
    return { date: todayIn(timeZone, instant), time };
  };
  const lines: (StockChangeLine & { at: string })[] = [];
  const ordered = [...changes].sort((a, b) => a.at.localeCompare(b.at));
  const used = new Set<StockChange>();

  for (const c of ordered) {
    if (used.has(c)) continue;
    used.add(c);
    if (c.source === "visit_item") {
      const start = Date.parse(c.at);
      const group = [c];
      // A save removes the visit's rows and then adds them again: a removal after an addition is the next save.
      for (const d of ordered) {
        if (used.has(d) || d.source !== "visit_item" || d.visitId !== c.visitId) continue;
        if (Date.parse(d.at) - start > sameSave) break;
        if (d.action === "delete" && group.some((g) => g.action === "insert")) break;
        group.push(d);
        used.add(d);
      }
      const before = group.filter((g) => g.action !== "insert").map((g) => g.oldQuantity);
      const after = group.filter((g) => g.action !== "delete").map((g) => g.newQuantity);
      const last = group[group.length - 1];
      const base = { ...when(last.at), at: last.at, of: last.visitDate ?? c.visitDate };
      if (before.length === 0) {
        if (base.of !== null && base.of < base.date) lines.push({ ...base, kind: "visitAdded", from: null, to: joined(after) });
      } else if (after.length === 0) lines.push({ ...base, kind: "visitRemoved", from: joined(before), to: null });
      else if (sorted(before).join("\n") !== sorted(after).join("\n")) lines.push({ ...base, kind: "visitChanged", from: joined(before), to: joined(after) });
      continue;
    }
    const base = { ...when(c.at), at: c.at };
    if (c.source === "visit" && c.action === "update") lines.push({ ...base, kind: "visitDate", of: c.visitDate, from: c.visitDate, to: c.newVisitDate });
    else if (c.source === "visit") lines.push({ ...base, kind: "visitDeleted", of: c.visitDate, from: c.oldQuantity, to: null });
    else {
      const what = c.source === "receipt" ? "receipt" : "correction";
      lines.push({ ...base, kind: `${what}${c.action === "delete" ? "Deleted" : "Changed"}`, of: c.rowDate, from: null, to: null });
    }
  }
  return lines.sort((a, b) => b.at.localeCompare(a.at)).map(({ at: _at, ...line }) => line);
}

export type HistoryRow = { type: "event"; entry: StockHistoryEntry } | { type: "change"; line: StockChangeLine };

/**
 * SK4: the stock events (by the day they happened) and the changes (by the day they were made) in one
 * list, newest first; on the same day a change comes first, since it was made afterwards.
 */
export function mergeHistory(entries: readonly StockHistoryEntry[], changes: readonly StockChangeLine[]): HistoryRow[] {
  const rows: HistoryRow[] = [];
  let i = 0;
  let j = 0;
  while (i < entries.length || j < changes.length) {
    if (j < changes.length && (i >= entries.length || changes[j].date >= entries[i].date)) rows.push({ type: "change", line: changes[j++] });
    else rows.push({ type: "event", entry: entries[i++] });
  }
  return rows;
}
