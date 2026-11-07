"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { formatDayMonth, formatIsoDate } from "@/logic/rules/dates";
import { needsReadingHint } from "@/logic/rules/consumption";
import type { StockHistoryEntry } from "@/logic/rules/stock";
import { mergeHistory, type StockChangeLine } from "@/logic/rules/stock-changes";

const page = 10;

/**
 * SK3 «История ▾»: hidden until tapped – every receipt, visit, discard and correction with what was
 * left after it, newest first, ten at a time. No client names.
 */
export function StockHistory({ entries, changes = [], unit }: { entries: StockHistoryEntry[]; changes?: StockChangeLine[]; unit: string }) {
  const t = useTranslations("stock");
  const [shown, setShown] = useState(0);
  const fmt = (n: number) => String(Math.round(n * 10) / 10).replace(".", ",");
  const signed = (n: number) => (n > 0 ? `+${fmt(n)}` : n < 0 ? `−${fmt(-n)}` : "0");
  const change = (e: StockHistoryEntry) =>
    e.change === null ? t("history.notCounted") : e.kind === "receipt" && e.vials && !e.vials.opened ? `+${e.vials.count} × ${e.vials.size}` : signed(e.change);
  const label = (e: StockHistoryEntry) =>
    e.kind === "receipt" ? t(e.vials?.opened ? "history.receiptOpened" : "history.receipt") : t(`history.${e.kind}`);

  // SK4: what was changed afterwards, with time and from → to; no stock column of its own.
  const changeText = (c: StockChangeLine) => {
    const of = c.of ? formatDayMonth(c.of) : "";
    const label = c.kind === "visitDate" ? t("history.change.visitDate", { from: formatDayMonth(c.from!), to: formatDayMonth(c.to!) }) : t(`history.change.${c.kind}`, { date: of });
    const values = c.kind === "visitDate" ? null : c.from !== null && c.to !== null ? `«${c.from}» → «${c.to}»` : c.from !== null ? `«${c.from}»` : c.to !== null ? `«${c.to}»` : null;
    return { label, values };
  };
  const rows = mergeHistory(entries, changes);

  if (rows.length === 0) return null;
  return (
    <div className="flex flex-col">
      <button
        type="button"
        aria-expanded={shown > 0}
        onClick={() => setShown(shown > 0 ? 0 : page)}
        className="inline-flex min-h-11 items-center gap-1 self-start text-base font-medium text-accent"
      >
        {t("history.title")} <span aria-hidden className={shown > 0 ? "rotate-180" : ""}>▾</span>
      </button>
      {shown > 0 && (
        <>
          <table className="w-full text-sm">
            <caption className="sr-only">
              {t("history.title")} · {unit}
            </caption>
            <tbody>
              {rows.slice(0, shown).map((row, i) => {
                if (row.type === "change") {
                  const c = changeText(row.line);
                  return (
                    <tr key={i} className="border-t border-line text-ink">
                      <td className="py-2 pr-2 align-top whitespace-nowrap text-muted">
                        {formatIsoDate(row.line.date)}
                        <span className="block text-xs">{row.line.time}</span>
                      </td>
                      <td colSpan={3} className="py-2">
                        <span className="text-accent">✎ </span>
                        {c.label}
                        {c.values && <span className="block text-xs text-muted">{c.values}</span>}
                      </td>
                    </tr>
                  );
                }
                const e = row.entry;
                return (
                  <tr key={i} className={`border-t border-line ${e.change === null ? "text-muted" : "text-ink"}`}>
                    <td className="py-2 pr-2 whitespace-nowrap text-muted">{formatIsoDate(e.date)}</td>
                    <td className="py-2 pr-2">
                      {label(e)}
                      {e.kind === "visit" && needsReadingHint(e.text) && <span className="block text-xs text-muted">«{e.text!.trim()}»</span>}
                      {e.kind === "visit" && e.change === null && !needsReadingHint(e.text) && <span className="block text-xs text-muted">{t("history.empty")}</span>}
                    </td>
                    <td className="py-2 pr-2 text-right whitespace-nowrap tabular-nums">{change(e)}</td>
                    <td className="py-2 text-right whitespace-nowrap font-semibold tabular-nums">{fmt(e.balance)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {shown < rows.length && (
            <button type="button" onClick={() => setShown(shown + page)} className="inline-flex min-h-11 items-center self-center text-sm font-medium text-accent">
              {t("history.more")}
            </button>
          )}
        </>
      )}
    </div>
  );
}
