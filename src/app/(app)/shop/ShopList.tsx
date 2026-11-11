"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useMemo, useOptimistic, useState, useTransition } from "react";
import { card, pill, ui } from "@/app/components/ui";
import { formatIsoDate } from "@/logic/rules/dates";
import { matchesShopFilter, shopStockSections, type ShopMovementKind } from "@/logic/rules/shop";
import type { ShopLine } from "@/logic/usecases/shop";
import { deleteShopHistoryAction, tapShopAction, toggleShopFavoriteAction } from "./actions";

type Props = { mode: "catalog" | "stock"; lines: ShopLine[]; brands: string[]; locale: string };

/**
 * MG1/MG2: «Каталог» and «Склад» of «Магазин» – search, a filter per brand, ⭐ first, grouped by
 * brand and category. Catalogue: price, ⭐ and «Изменить». Stock (MG5): what is in stock first, most
 * first; «−» asks «Товар продан?» (MG6) and is off at 0 (MG7); «+» (came in); «История ▾» per product.
 */
export function ShopList({ mode, lines, brands, locale }: Props) {
  const t = useTranslations("shop");
  const [query, setQuery] = useState("");
  const [brand, setBrand] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ productId: string; date: string; kind: string } | null>(null);
  const [failed, setFailed] = useState<false | "failed" | "negative">(false);
  const [selling, setSelling] = useState<ShopLine | null>(null);
  const [pending, startTransition] = useTransition();
  // MG2: a tap shows at once; the server's number replaces it when saved.
  const [optimistic, addOptimistic] = useOptimistic(lines, (state, change: { id: string; delta?: number; favorite?: boolean }) =>
    state.map((l) => (l.id === change.id ? { ...l, stock: l.stock + (change.delta ?? 0), favorite: change.favorite ?? l.favorite } : l)),
  );
  const money = (value: number, currency: string) => new Intl.NumberFormat(locale, { style: "currency", currency, currencyDisplay: "narrowSymbol", maximumFractionDigits: 2 }).format(value);

  const shown = useMemo(() => optimistic.filter((l) => matchesShopFilter(l, query, brand)), [optimistic, query, brand]);
  // MG5: in «Склад» one list of what is in stock comes first; the catalogue keeps ⭐ first.
  const sections = mode === "stock" ? shopStockSections(shown) : { inStock: [], favorites: shown.filter((l) => l.favorite), rest: shown.filter((l) => !l.favorite) };
  const favorites = sections.favorites;
  const groups = new Map<string, ShopLine[]>();
  for (const l of sections.rest) {
    const key = `${l.brand} · ${l.category || "—"}`;
    groups.set(key, [...(groups.get(key) ?? []), l]);
  }

  const tap = (line: ShopLine, kind: ShopMovementKind) =>
    startTransition(async () => {
      addOptimistic({ id: line.id, delta: kind === "receipt" ? 1 : -1 });
      await tapShopAction(line.id, kind);
    });
  const star = (line: ShopLine) =>
    startTransition(async () => {
      addOptimistic({ id: line.id, favorite: !line.favorite });
      await toggleShopFavoriteAction(line.id);
    });

  const row = (l: ShopLine) => (
    <li key={l.id} className="flex flex-col border-b border-line px-4 py-2 last:border-b-0">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => star(l)}
          aria-pressed={l.favorite}
          aria-label={t(l.favorite ? "unfavorite" : "favorite")}
          className={`flex size-11 shrink-0 items-center justify-center text-xl ${l.favorite ? "text-accent" : "text-muted"}`}
        >
          {l.favorite ? "★" : "☆"}
        </button>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="break-words text-base font-semibold text-ink">{l.name}</span>
          <span className="text-sm text-muted">{[l.size, money(l.price, l.currency)].filter(Boolean).join(" · ")}</span>
        </div>
        {mode === "catalog" ? (
          <Link href={`/shop/products/${l.id}/edit`} className={`${ui.textButton} shrink-0 text-sm`}>
            {t("edit")}
          </Link>
        ) : (
          <div className="flex shrink-0 items-center gap-1">
            <button type="button" onClick={() => setSelling(l)} disabled={l.stock <= 0} aria-label={t("sell", { name: l.name })} className="flex size-11 items-center justify-center rounded-full border border-field text-xl text-ink disabled:opacity-30">
              −
            </button>
            <span className="w-10 text-center text-lg font-semibold tabular-nums text-ink">{Math.max(0, l.stock)}</span>
            <button type="button" onClick={() => tap(l, "receipt")} aria-label={t("receive", { name: l.name })} className="flex size-11 items-center justify-center rounded-full bg-primary text-xl text-on-primary">
              +
            </button>
          </div>
        )}
      </div>
      {mode === "stock" && l.history.length > 0 && (
        <button type="button" onClick={() => setOpen(open === l.id ? null : l.id)} aria-expanded={open === l.id} className="ml-12 inline-flex min-h-11 items-center self-start text-sm text-accent">
          {t("history")} {open === l.id ? "▴" : "▾"}
        </button>
      )}
      {mode === "stock" && open === l.id && (
        <ul className="ml-12 flex flex-col">
          {l.history.slice(0, 20).map((h) => (
            <li key={`${h.date}${h.kind}`} className="flex items-center justify-between gap-2 border-t border-line text-sm">
              <span className="text-muted">{formatIsoDate(h.date)}</span>
              <span className="flex-1">{t(h.kind === "sale" ? "historySale" : h.kind === "correction" ? "historyCorrection" : h.kind === "order" ? "historyOrder" : h.kind === "return" ? "historyReturn" : "historyReceipt", { count: h.quantity })}</span>
              <span className="font-semibold tabular-nums">{h.balance}</span>
              {h.kind === "order" || h.kind === "return" ? <span className="min-w-14" /> : <button type="button" onClick={() => { setFailed(false); setConfirm({ productId: l.id, date: h.date, kind: h.kind }); }} className="inline-flex min-h-11 items-center text-xs text-on-alert">
                {t("delete")}
              </button>}
            </li>
          ))}
        </ul>
      )}
    </li>
  );

  return (
    <div className="flex flex-col gap-4">
      <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("search")} aria-label={t("search")} className={ui.input} />
      <div className="flex flex-wrap gap-2" role="group" aria-label={t("brandFilter")}>
        {[null, ...brands].map((b) => (
          <button key={b ?? "all"} type="button" onClick={() => setBrand(b)} aria-pressed={brand === b} className={`${pill.base} ${brand === b ? pill.on : pill.off}`}>
            {b ?? t("all")}
          </button>
        ))}
      </div>
      {shown.length === 0 && <p className={`${card.surface} px-5 py-10 text-center ${ui.muted}`}>{t("empty")}</p>}
      {sections.inStock.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="px-1 text-sm font-semibold text-muted">{t("inStock")}</h2>
          <ul className={`${card.surface} flex flex-col`}>{sections.inStock.map(row)}</ul>
        </section>
      )}
      {favorites.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="px-1 text-sm font-semibold text-muted">⭐ {t("favorites")}</h2>
          <ul className={`${card.surface} flex flex-col`}>{favorites.map(row)}</ul>
        </section>
      )}
      {[...groups.entries()].map(([key, items]) => (
        <section key={key} className="flex flex-col gap-2">
          <h2 className="px-1 text-sm font-semibold text-muted">{key}</h2>
          <ul className={`${card.surface} flex flex-col`}>{items.map(row)}</ul>
        </section>
      ))}
      {selling && (
        <div role="alertdialog" aria-label={t("soldQuestion")} className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-w-2xl flex-col gap-3 rounded-t-[18px] border-t border-line bg-surface p-4 pb-[calc(1rem+var(--safe-bottom))] text-ink shadow-lg">
          <p className="text-base">
            <span className="font-semibold">{t("soldQuestion")}</span>
            <br />
            <span className="text-muted">{selling.name}</span>
          </p>
          <button type="button" onClick={() => { tap(selling, "sale"); setSelling(null); }} className={ui.button}>
            {t("soldYes")}
          </button>
          <button type="button" onClick={() => { tap(selling, "correction"); setSelling(null); }} className="min-h-11 rounded-[14px] border border-field px-3 text-base text-ink">
            {t("soldNo")}
          </button>
          <button type="button" onClick={() => setSelling(null)} className={`${ui.textButton} justify-center`}>
            {t("cancel")}
          </button>
        </div>
      )}
      {confirm && (
        <div role="alertdialog" aria-label={t("delete")} className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-w-2xl flex-col gap-3 rounded-t-[18px] bg-alert p-4 pb-[calc(1rem+var(--safe-bottom))] text-on-alert shadow-lg">
          <p className="text-base">{t("confirmDelete")}</p>
          {failed && <p className="text-sm font-semibold">{t(failed === "negative" ? "deleteNegative" : "failed")}</p>}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setConfirm(null)} className="min-h-11 rounded-[14px] border border-current px-3 text-sm">
              {t("cancel")}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const { ok, negative } = await deleteShopHistoryAction(confirm.productId, confirm.date, confirm.kind);
                  if (ok) setConfirm(null);
                  else setFailed(negative ? "negative" : "failed");
                })
              }
              className="min-h-11 rounded-[14px] bg-on-alert px-3 text-sm font-semibold text-alert disabled:opacity-50"
            >
              {t("deleteYes")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
