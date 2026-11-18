"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useMemo, useOptimistic, useRef, useState, useTransition } from "react";
import { card, pill, ui } from "@/app/components/ui";
import { formatIsoDate } from "@/logic/rules/dates";
import { matchesShopFilter, shopStockSections, type ShopMovementKind } from "@/logic/rules/shop";
import type { ShopLine } from "@/logic/usecases/shop";
import { matchesBuyer, preselect, type ShopBuyer, type WaitEntry } from "@/logic/rules/shop-orders";
import { giveToOrderAction, receiveForAction, releaseReservationAction, sellToBuyerAction, undoSaleToBuyerAction } from "./order-actions";
import { useToast } from "@/app/components/Toast";
import { deleteShopHistoryAction, tapShopAction, toggleShopFavoriteAction, undoTapAction } from "./actions";

type Row = ShopLine & { free: number };
type Props = { mode: "catalog" | "stock"; lines: ShopLine[]; brands: string[]; locale: string; waits?: Record<string, WaitEntry[]>; buyers?: ShopBuyer[] };

/**
 * MG1/MG2: «Каталог» and «Склад» of «Магазин» – search, a filter per brand, ⭐ first, grouped by
 * brand and category. Catalogue: price, ⭐ and «Изменить». Stock (MG5): what is in stock first, most
 * first; «−» asks «Товар продан?» (MG6) and is off at 0 (MG7); «+» (came in); «История ▾» per product.
 */
export function ShopList({ mode, lines, brands, locale, waits = {}, buyers = [] }: Props) {
  // MG16: what is put aside for orders («🔖 отложено») and what orders still wait for («⏳ ждёт»).
  const reservedOf = (id: string) => (waits[id] ?? []).reduce((s, w) => s + w.reserved, 0);
  const waitingOf = (id: string) => (waits[id] ?? []).reduce((s, w) => s + w.missing, 0);
  const [whoOpen, setWhoOpen] = useState<string | null>(null);
  // MG16: «Отдать ей» without a free piece → «У кого взять?»; «−» when all is put aside → the same question.
  const [takeFrom, setTakeFrom] = useState<{ line: ShopLine; to: WaitEntry | null } | null>(null);
  const released = useRef<string | null>(null);
  // MG16 «Кому отложить?»: how many came in and how many go to which order.
  const [incoming, setIncoming] = useState<{ line: ShopLine; count: string; picked: Record<string, number> } | null>(null);
  const t = useTranslations("shop");
  const [query, setQuery] = useState("");
  const [brand, setBrand] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ productId: string; date: string; kind: string } | null>(null);
  const [failed, setFailed] = useState<false | "failed" | "negative">(false);
  const [selling, setSelling] = useState<ShopLine | null>(null);
  // MG14: after «Да, продан» – «Кому?» (a buyer, a new one, or «Без имени»).
  const [askWho, setAskWho] = useState(false);
  const [who, setWho] = useState({ name: "", phone: "", instagram: "" });
  const [whoFailed, setWhoFailed] = useState<false | "failed" | "empty" | "noRate">(false);
  const closeSelling = (sold = false) => {
    // MG16: the piece was taken from an order but not sold after all – it goes back to that order.
    const back = released.current;
    released.current = null;
    if (!sold && back) startTransition(async () => void (await giveToOrderAction(back, null)));
    setSelling(null);
    setAskWho(false);
    setWho({ name: "", phone: "", instagram: "" });
    setWhoFailed(false);
  };
  const sellTo = (line: ShopLine, buyer: { buyerId?: string; name: string; phone?: string; instagram?: string }) =>
    startTransition(async () => {
      addOptimistic({ id: line.id, delta: -1 });
      const { ok, reason, orderId } = await sellToBuyerAction(line.id, buyer);
      if (ok) {
        closeSelling(true);
        // UX3: done at once – «Отменить» for 5 seconds.
        if (orderId) toast(tt("soldTo", { buyer: buyer.name, name: line.name }), () => undo(() => undoSaleToBuyerAction(orderId)));
      }
      else setWhoFailed(reason ?? "failed");
    });
  const toast = useToast();
  const tt = useTranslations("toast");
  const undo = async (run: () => Promise<{ ok: boolean }>) => {
    const { ok } = await run();
    toast(tt(ok ? "undone" : "undoFailed"));
  };
  // UX6: a long press on «+» asks «Сколько пришло?».
  const [receivingMany, setReceivingMany] = useState<ShopLine | null>(null);
  const [many, setMany] = useState("2");
  const press = useRef<{ timer: ReturnType<typeof setTimeout> | null; long: boolean }>({ timer: null, long: false });
  const [pending, startTransition] = useTransition();
  // MG2: a tap shows at once; the server's number replaces it when saved.
  const [optimistic, addOptimistic] = useOptimistic(lines, (state, change: { id: string; delta?: number; favorite?: boolean }) =>
    state.map((l) => (l.id === change.id ? { ...l, stock: l.stock + (change.delta ?? 0), favorite: change.favorite ?? l.favorite } : l)),
  );
  const money = (value: number, currency: string) => new Intl.NumberFormat(locale, { style: "currency", currency, currencyDisplay: "narrowSymbol", maximumFractionDigits: 2 }).format(value);

  // MG16: the big number is what lies in the cabinet – free plus put aside; «stock» stays the free part.
  const shown = useMemo(() => optimistic.filter((l) => matchesShopFilter(l, query, brand)), [optimistic, query, brand]);
  // MG5: in «Склад» one list of what is in stock comes first; the catalogue keeps ⭐ first.
  // «stock» becomes what lies in the cabinet (sorting, the big number); «free» is what can be sold without asking.
  const withAside = shown.map((l) => ({ ...l, free: Math.max(0, l.stock), stock: Math.max(0, l.stock) + reservedOf(l.id) }));
  const sections = mode === "stock" ? shopStockSections(withAside) : { inStock: [], favorites: withAside.filter((l) => l.favorite), rest: withAside.filter((l) => !l.favorite) };
  const favorites = sections.favorites;
  const groups = new Map<string, Row[]>();
  for (const l of sections.rest) {
    const key = `${l.brand} · ${l.category || "—"}`;
    groups.set(key, [...(groups.get(key) ?? []), l]);
  }

  const tap = (line: ShopLine, kind: ShopMovementKind, quantity = 1) =>
    startTransition(async () => {
      addOptimistic({ id: line.id, delta: kind === "receipt" ? quantity : -1 });
      const { ok, id } = await tapShopAction(line.id, kind, quantity);
      // UX3: done at once – «Отменить» for 5 seconds.
      if (ok && id) {
        const message = kind === "sale" ? tt("sold", { name: line.name }) : kind === "correction" ? tt("corrected", { name: line.name }) : tt("received", { name: line.name, count: quantity });
        toast(message, () => undo(() => undoTapAction(id)));
      } else if (!ok) toast(t("failed"));
    });
  // MG16 «Отдать ей»: a free piece if there is one, else from the order Loya picks.
  const give = (line: ShopLine, to: WaitEntry, from: WaitEntry | null) =>
    startTransition(async () => {
      const { ok } = await giveToOrderAction(to.itemId, from?.itemId ?? null);
      setTakeFrom(null);
      if (!ok) return toast(t("failed"));
      toast(
        tt("putAside", { name: line.name, buyer: to.buyerName }),
        () => undo(() => (from ? giveToOrderAction(from.itemId, to.itemId) : releaseReservationAction(to.itemId))),
      );
    });
  const freeOf = (l: Row) => l.free;
  const star = (line: ShopLine) =>
    startTransition(async () => {
      addOptimistic({ id: line.id, favorite: !line.favorite });
      await toggleShopFavoriteAction(line.id);
    });

  const row = (l: Row) => (
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
            <button
              type="button"
              onClick={() => (freeOf(l) > 0 ? setSelling(l) : setTakeFrom({ line: l, to: null }))}
              disabled={freeOf(l) + reservedOf(l.id) <= 0}
              aria-label={t("sell", { name: l.name })}
              className="flex size-11 items-center justify-center rounded-full border border-field text-xl text-ink disabled:opacity-30"
            >
              −
            </button>
            <span className="w-10 text-center text-lg font-semibold tabular-nums text-ink">{l.stock}</span>
            <button
              type="button"
              onPointerDown={() => {
                press.current.long = false;
                press.current.timer = setTimeout(() => {
                  press.current.long = true;
                  if (waitingOf(l.id) > 0) setIncoming({ line: l, count: "1", picked: preselect(waits[l.id] ?? [], 1) });
                  else {
                    setMany("2");
                    setReceivingMany(l);
                  }
                }, 500);
              }}
              onPointerUp={() => press.current.timer && clearTimeout(press.current.timer)}
              onPointerLeave={() => press.current.timer && clearTimeout(press.current.timer)}
              onContextMenu={(e) => e.preventDefault()}
              onClick={() => {
                if (press.current.long) return;
                if (waitingOf(l.id) > 0) setIncoming({ line: l, count: "1", picked: preselect(waits[l.id] ?? [], 1) });
                else tap(l, "receipt");
              }}
              aria-label={t("receive", { name: l.name })}
              className="flex size-11 touch-manipulation select-none items-center justify-center rounded-full bg-primary text-xl text-on-primary"
            >
              +
            </button>
          </div>
        )}
      </div>
      {mode === "stock" && (reservedOf(l.id) > 0 || waitingOf(l.id) > 0) && (
        <button type="button" onClick={() => setWhoOpen(whoOpen === l.id ? null : l.id)} aria-expanded={whoOpen === l.id} className="ml-12 flex min-h-11 flex-wrap items-center gap-2 self-start">
          {reservedOf(l.id) > 0 && <span className="rounded-full border border-warn-line bg-warn px-3 py-1 text-sm font-semibold text-on-warn">🔖 {t("reservedChip", { count: reservedOf(l.id) })}</span>}
          {waitingOf(l.id) > 0 && <span className="rounded-full border border-warn-line bg-warn px-3 py-1 text-sm font-semibold text-on-warn">⏳ {t("waitingChip", { count: waitingOf(l.id) })}</span>}
          <span className="text-sm text-accent">{whoOpen === l.id ? "▴" : "▾"}</span>
        </button>
      )}
      {mode === "stock" && whoOpen === l.id && (
        <ul aria-label={t("whoWaits")} className="ml-12 flex flex-col rounded-[14px] border-2 border-warn-line">
          {(waits[l.id] ?? []).map((w) => (
            <li key={w.itemId} className="flex items-center justify-between gap-2 border-b border-line px-3 py-2 last:border-b-0">
              <span className="flex min-w-0 flex-col">
                <span className="text-base font-semibold text-ink">
                  {w.missing > 0 ? "⏳" : "🔖"} {w.buyerName}
                </span>
                <span className="text-sm text-muted">
                  {formatIsoDate(w.orderedOn)} · 💳 {t(`orders.pay.${w.paid}`)}
                  {w.reserved > 0 && ` · ${t("reservedChip", { count: w.reserved })}`}
                  {w.missing > 0 && ` · ${t("waitingChip", { count: w.missing })}`}
                </span>
              </span>
              {w.missing > 0 && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => (freeOf(l) > 0 ? give(l, w, null) : setTakeFrom({ line: l, to: w }))}
                  className="inline-flex min-h-11 shrink-0 items-center rounded-full bg-primary px-3 text-sm font-semibold text-on-primary disabled:opacity-50"
                >
                  {t("giveHer")}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
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
      {mode === "stock" && Object.keys(waits).some((id) => waitingOf(id) > 0) && (
        <section className="flex flex-col gap-2">
          <h2 className="px-1 text-base font-semibold text-ink">⚠ {t("needToOrderTitle")}</h2>
          <ul className="flex flex-col rounded-[18px] border-2 border-warn-line bg-warn text-on-warn">
            {Object.entries(waits).filter(([id]) => waitingOf(id) > 0).map(([productId, all]) => {
              const list = all.filter((w) => w.missing > 0);
              const product = lines.find((x) => x.id === productId);
              return (
                <li key={productId} className="flex flex-col gap-0.5 border-b border-warn-line px-4 py-3 last:border-b-0">
                  <span className="text-base font-semibold">
                    {product?.name ?? "—"} · {t("piecesShort", { count: list.reduce((s, w) => s + w.missing, 0) })}
                  </span>
                  <span className="text-sm">{list.map((w) => `${w.buyerName} (${w.missing})`).join(", ")}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
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
      {receivingMany && (
        <div role="alertdialog" aria-label={t("howMany")} className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-w-2xl flex-col gap-3 rounded-t-[18px] border-t border-line bg-surface p-4 pb-[calc(1rem+var(--safe-bottom))] text-ink shadow-lg">
          <p className="text-base">
            <span className="font-semibold">{t("howMany")}</span>
            <br />
            <span className="text-muted">{receivingMany.name}</span>
          </p>
          <input value={many} onChange={(e) => setMany(e.target.value)} inputMode="numeric" aria-label={t("howMany")} className={ui.input} />
          <button
            type="button"
            disabled={!(Number(many) >= 1 && Number(many) <= 100 && Number.isInteger(Number(many)))}
            onClick={() => {
              tap(receivingMany, "receipt", Number(many));
              setReceivingMany(null);
            }}
            className={ui.button}
          >
            {t("addMany", { count: Number(many) || 0 })}
          </button>
          <button type="button" onClick={() => setReceivingMany(null)} className={`${ui.textButton} justify-center`}>
            {t("cancel")}
          </button>
        </div>
      )}
      {incoming && (
        <div role="alertdialog" aria-label={t("whomToPutAside")} className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[85vh] max-w-2xl flex-col gap-3 overflow-y-auto rounded-t-[18px] border-t border-line bg-surface p-4 pb-[calc(1rem+var(--safe-bottom))] text-ink shadow-lg">
          <p className="text-base">
            <span className="font-semibold">{t("whomToPutAside")}</span>
            <br />
            <span className="text-muted">{incoming.line.name}</span>
          </p>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-muted">{t("howMany")}</span>
            <input
              value={incoming.count}
              onChange={(e) => {
                const n = Number(e.target.value);
                setIncoming({ ...incoming, count: e.target.value, picked: Number.isInteger(n) && n > 0 ? preselect(waits[incoming.line.id] ?? [], n) : {} });
              }}
              inputMode="numeric"
              className={ui.input}
            />
          </label>
          <ul className="flex flex-col rounded-[14px] border border-field">
            {(waits[incoming.line.id] ?? []).filter((w) => w.missing > 0).map((w) => {
              const on = (incoming.picked[w.itemId] ?? 0) > 0;
              return (
                <li key={w.itemId}>
                  <label className="flex min-h-11 items-center gap-3 border-b border-line px-3 py-2 last:border-b-0">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => {
                        const picked = { ...incoming.picked };
                        if (on) delete picked[w.itemId];
                        else picked[w.itemId] = w.missing;
                        setIncoming({ ...incoming, picked });
                      }}
                      className="size-5 accent-[var(--accent)]"
                    />
                    <span className="flex min-w-0 flex-col">
                      <span className="text-base text-ink">{w.buyerName}</span>
                      <span className="text-sm text-muted">
                        {formatIsoDate(w.orderedOn)} · 💳 {t(`orders.pay.${w.paid}`)} · {t("waitingChip", { count: w.missing })}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          <p className="text-sm text-muted">{t("restToStock")}</p>
          <button
            type="button"
            disabled={pending || !(Number(incoming.count) >= 1 && Number(incoming.count) <= 100 && Number.isInteger(Number(incoming.count)))}
            onClick={() =>
              startTransition(async () => {
                const { ok } = await receiveForAction(incoming.line.id, Number(incoming.count), incoming.picked);
                setIncoming(null);
                toast(ok ? tt("received", { name: incoming.line.name, count: Number(incoming.count) }) : t("failed"));
              })
            }
            className={ui.button}
          >
            {t("done")}
          </button>
          <button type="button" onClick={() => setIncoming(null)} className={`${ui.textButton} justify-center`}>
            {t("cancel")}
          </button>
        </div>
      )}
      {takeFrom && (
        <div role="alertdialog" aria-label={t("takeFromWhom")} className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[85vh] max-w-2xl flex-col gap-2 overflow-y-auto rounded-t-[18px] border-t border-line bg-surface p-4 pb-[calc(1rem+var(--safe-bottom))] text-ink shadow-lg">
          <p className="text-base">
            <span className="font-semibold">{takeFrom.to ? t("takeFromWhom") : t("allPutAside")}</span>
            <br />
            <span className="text-muted">
              {takeFrom.line.name}
              {takeFrom.to && ` → ${takeFrom.to.buyerName}`}
            </span>
          </p>
          {(waits[takeFrom.line.id] ?? [])
            .filter((w) => w.reserved > 0 && w.itemId !== takeFrom.to?.itemId)
            .map((w) => (
              <button
                key={w.itemId}
                type="button"
                disabled={pending}
                onClick={() => {
                  const target = takeFrom.to;
                  if (target) return give(takeFrom.line, target, w);
                  // «−» when all is put aside: the piece is taken from her order, then sold as usual («Кому?»).
                  startTransition(async () => {
                    const { ok } = await releaseReservationAction(w.itemId);
                    if (!ok) return toast(t("failed"));
                    released.current = w.itemId;
                    setSelling(takeFrom.line);
                    setTakeFrom(null);
                  });
                }}
                className="flex min-h-11 flex-col items-start rounded-[14px] border border-field px-4 py-2 text-left"
              >
                <span className="text-base text-ink">🔖 {w.buyerName}</span>
                <span className={ui.muted}>
                  {formatIsoDate(w.orderedOn)} · 💳 {t(`orders.pay.${w.paid}`)} · {t("reservedChip", { count: w.reserved })}
                </span>
              </button>
            ))}
          <p className="text-sm text-muted">{t("waitsNextDelivery")}</p>
          <button type="button" onClick={() => setTakeFrom(null)} className={`${ui.textButton} justify-center`}>
            {t("cancel")}
          </button>
        </div>
      )}
      {selling && (
        <div role="alertdialog" aria-label={askWho ? t("whoQuestion") : t("soldQuestion")} className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[85vh] max-w-2xl flex-col gap-3 overflow-y-auto rounded-t-[18px] border-t border-line bg-surface p-4 pb-[calc(1rem+var(--safe-bottom))] text-ink shadow-lg">
          <p className="text-base">
            <span className="font-semibold">{askWho ? t("whoQuestion") : t("soldQuestion")}</span>
            <br />
            <span className="text-muted">{selling.name}</span>
          </p>
          {!askWho ? (
            <>
              <button type="button" onClick={() => setAskWho(true)} className={ui.button}>
                {t("soldYes")}
              </button>
              <button type="button" onClick={() => { tap(selling, "correction"); closeSelling(true); }} className="min-h-11 rounded-[14px] border border-field px-3 text-base text-ink">
                {t("soldNo")}
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => { tap(selling, "sale"); closeSelling(true); }} className={ui.button}>
                {t("noName")}
              </button>
              <input
                value={who.name}
                onChange={(e) => setWho({ ...who, name: e.target.value })}
                autoComplete="off"
                placeholder={t("whoPlaceholder")}
                aria-label={t("whoPlaceholder")}
                className={ui.input}
              />
              {who.name.trim() && (
                <ul className="flex flex-col rounded-[14px] border border-field">
                  {buyers
                    .filter((b) => matchesBuyer(b, who.name))
                    .slice(0, 5)
                    .map((b) => (
                      <li key={b.id}>
                        <button type="button" disabled={pending} onClick={() => sellTo(selling, { buyerId: b.id, name: b.name, phone: b.phone, instagram: b.instagram })} className="flex min-h-11 w-full flex-col items-start border-b border-line px-4 py-2 text-left last:border-b-0">
                          <span className="text-base text-ink">{b.name}</span>
                          <span className={ui.muted}>{[b.instagram && `@${b.instagram}`, b.phone].filter(Boolean).join(" · ")}</span>
                        </button>
                      </li>
                    ))}
                  <li className="flex flex-col gap-2 p-3">
                    <span className="text-sm font-semibold text-ink">{t("newBuyer", { name: who.name.trim() })}</span>
                    <div className="grid grid-cols-2 gap-2">
                      <input value={who.phone} onChange={(e) => setWho({ ...who, phone: e.target.value })} type="tel" inputMode="tel" placeholder={t("phone")} aria-label={t("phone")} className={ui.input} />
                      <input value={who.instagram} onChange={(e) => setWho({ ...who, instagram: e.target.value })} autoCapitalize="none" placeholder="@Instagram" aria-label="Instagram" className={ui.input} />
                    </div>
                    <button type="button" disabled={pending} onClick={() => sellTo(selling, { name: who.name, phone: who.phone, instagram: who.instagram })} className={ui.button}>
                      {t("saveSale")}
                    </button>
                  </li>
                </ul>
              )}
              {whoFailed && <p className={ui.error}>{t(whoFailed === "empty" ? "whoEmpty" : whoFailed === "noRate" ? "whoNoRate" : "failed")}</p>}
            </>
          )}
          <button type="button" onClick={() => closeSelling()} className={`${ui.textButton} justify-center`}>
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
