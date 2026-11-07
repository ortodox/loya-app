"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState, useTransition } from "react";
import { formatDayMonth, formatIsoDate } from "@/logic/rules/dates";
import { needsReadingHint } from "@/logic/rules/consumption";
import type { StockHistoryEntry } from "@/logic/rules/stock";
import { mergeHistory, type StockChangeLine } from "@/logic/rules/stock-changes";
import type { HistoryLineRef } from "@/logic/usecases/stock";
import { deleteHistoryLineAction } from "./actions";

const page = 10;

/**
 * SK3 «История ▾»: hidden until tapped – every receipt, visit, discard and correction with what was
 * left after it, newest first, ten at a time. No client names.
 */
export function StockHistory({
  itemId,
  entries,
  changes = [],
  clients = {},
  unit,
}: {
  /** SK8: the preparation in stock – «Удалить» removes a line of its «История». */
  itemId?: string;
  entries: StockHistoryEntry[];
  changes?: StockChangeLine[];
  /** SK7: the clients' names; a deleted client is shown grey, without a link. */
  clients?: Record<string, { name: string; deleted: boolean }>;
  unit: string;
}) {
  const t = useTranslations("stock");
  const [shown, setShown] = useState(0);
  // SK8: «Удалить» – which line is waiting for «Да, удалить», and whether it failed.
  const [confirm, setConfirm] = useState<HistoryLineRef | null>(null);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();
  const remove = (ref: HistoryLineRef | null) =>
    itemId && ref ? (
      <button
        type="button"
        onClick={() => {
          setFailed(false);
          setConfirm(ref);
        }}
        className="flex min-h-11 items-center text-xs text-on-alert"
      >
        {t("history.delete")}
      </button>
    ) : null;
  const fmt = (n: number) => String(Math.round(n * 10) / 10).replace(".", ",").replace("-", "−");
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
  // SK7: the client's name opens the client card.
  const client = (id: string | null | undefined) => {
    const c = id ? clients[id] : undefined;
    if (!id || !c) return null;
    return c.deleted ? (
      <span className="block text-xs text-muted">
        {c.name} · {t("history.clientDeleted")}
      </span>
    ) : (
      <Link href={`/clients/${id}`} className="flex min-h-11 items-center text-sm font-medium text-accent underline">
        {c.name}
      </Link>
    );
  };

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
                        {client(row.line.clientId)}
                        {c.values && <span className="block text-xs text-muted">{c.values}</span>}
                        {row.line.ids && row.line.ids.length > 0 && remove({ change: row.line.ids })}
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
                      {e.kind === "visit" && client(e.clientId)}
                      {e.kind === "visit" && needsReadingHint(e.text) && <span className="block text-xs text-muted">«{e.text!.trim()}»</span>}
                      {e.kind === "visit" && e.change === null && !needsReadingHint(e.text) && <span className="block text-xs text-muted">{t("history.empty")}</span>}
                      {e.key && remove({ key: e.key })}
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
      {confirm && itemId && (
        <div
          role="alertdialog"
          aria-label={t("history.delete")}
          className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-w-2xl flex-col gap-3 rounded-t-[18px] bg-alert p-4 pb-[calc(1rem+var(--safe-bottom))] text-on-alert shadow-lg"
        >
          <p className="text-base">{t("history.confirmDelete")}</p>
          {failed && <p className="text-sm font-semibold">{t("failed")}</p>}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setConfirm(null)} className="min-h-11 rounded-[14px] border border-current px-3 text-sm">
              {t("cancel")}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const { ok } = await deleteHistoryLineAction(itemId, confirm);
                  if (ok) setConfirm(null);
                  else setFailed(true);
                })
              }
              className="min-h-11 rounded-[14px] bg-on-alert px-3 text-sm font-semibold text-alert disabled:opacity-50"
            >
              {t("history.deleteYes")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
