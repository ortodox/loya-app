"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { card, ui } from "@/app/components/ui";
import { formatIsoDate } from "@/logic/rules/dates";
import { matchesShopFilter } from "@/logic/rules/shop";
import { matchesBuyer, orderTotal, type EurRate, type ShopBuyer, type ShopOrder } from "@/logic/rules/shop-orders";
import type { OrderErrors, OrderFormProduct } from "@/logic/usecases/shop-orders";
import { cancelOrderAction, saveOrderAction } from "./order-actions";

type Line = { key: number; productId: string; quantity: string; price: string };
type Props = { products: OrderFormProduct[]; buyers: ShopBuyer[]; order: ShopOrder | null; buyer: ShopBuyer | null; rate: EurRate | null; locale: string };

/**
 * MG9 «+ Заказ» / «Изменить»: a buyer (suggested from earlier ones, kept apart from clients), any number of
 * products with quantity and price in zł (Instytutum by the € rate, all prices can be changed), total.
 */
export function OrderForm({ products, buyers, order, buyer, rate, locale }: Props) {
  const t = useTranslations("shop.orders");
  const [buyerId, setBuyerId] = useState<string | null>(buyer?.id ?? null);
  const [name, setName] = useState(buyer?.name ?? "");
  const [phone, setPhone] = useState(buyer?.phone ?? "");
  const [instagram, setInstagram] = useState(buyer?.instagram ? `@${buyer.instagram}` : "");
  const [lines, setLines] = useState<Line[]>(
    order?.items.map((i, n) => ({ key: n, productId: i.productId, quantity: String(i.quantity), price: String(i.price).replace(".", ",") })) ?? [],
  );
  const [query, setQuery] = useState("");
  const [errors, setErrors] = useState<OrderErrors & { failed?: boolean }>({});
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [pending, startTransition] = useTransition();
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const zl = (v: number) => new Intl.NumberFormat(locale, { style: "currency", currency: "PLN", currencyDisplay: "narrowSymbol", maximumFractionDigits: 2 }).format(v);
  const num = (v: number) => new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(v);

  const buyerSuggestions = !buyerId && name.trim().length > 0 ? buyers.filter((b) => matchesBuyer(b, name)).slice(0, 5) : [];
  const productResults = query.trim().length > 0 ? products.filter((p) => matchesShopFilter({ ...p, category: "", favorite: false, active: true, sortOrder: 0 }, query, null)).slice(0, 8) : [];
  const total = orderTotal(lines.map((l) => ({ quantity: Number(l.quantity) || 0, price: Number(l.price.replace(",", ".")) || 0 })));

  const add = (p: OrderFormProduct) => {
    setLines((ls) => {
      const found = ls.find((l) => l.productId === p.id);
      if (found) return ls.map((l) => (l === found ? { ...l, quantity: String((Number(l.quantity) || 0) + 1) } : l));
      return [...ls, { key: Date.now(), productId: p.id, quantity: "1", price: p.suggested === null ? "" : String(p.suggested).replace(".", ",") }];
    });
    setQuery("");
  };
  const change = (key: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const pick = (b: ShopBuyer) => {
    setBuyerId(b.id);
    setName(b.name);
    setPhone(b.phone);
    setInstagram(b.instagram ? `@${b.instagram}` : "");
  };
  const save = () =>
    startTransition(async () => {
      const result = await saveOrderAction(order?.id ?? null, {
        buyerId,
        buyerName: name,
        buyerPhone: phone,
        buyerInstagram: instagram,
        items: lines.map((l) => ({ productId: l.productId, quantity: l.quantity, price: l.price })),
      });
      setErrors(result.errors ? { ...result.errors } : result.failed ? { failed: true } : {});
    });

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between gap-4">
        <Link href="/shop?view=orders" className={ui.textButton}>
          {t("cancel")}
        </Link>
        <h1 className="text-center font-serif text-2xl text-ink">{order ? t("editTitle") : t("newTitle")}</h1>
        <button type="button" onClick={save} disabled={pending} className={`${ui.textButton} font-semibold disabled:opacity-50`}>
          {t("save")}
        </button>
      </header>

      <section className={`${card.surface} flex flex-col gap-3 p-4`}>
        <h2 className={card.heading}>{t("buyer")}</h2>
        <label className="flex flex-col gap-1">
          <span className={card.label}>{t("buyerName")}</span>
          <div className="flex gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" placeholder={t("buyerNameHint")} className={ui.input} />
            {buyerId && (
              <button
                type="button"
                onClick={() => {
                  setBuyerId(null);
                  setName("");
                  setPhone("");
                  setInstagram("");
                }}
                className={`${ui.textButton} shrink-0 text-sm`}
              >
                {t("otherBuyer")}
              </button>
            )}
          </div>
        </label>
        {errors.buyerName && <p className={ui.error}>{t("errors.buyerName")}</p>}
        {buyerSuggestions.length > 0 && (
          <ul className="flex flex-col rounded-[14px] border border-field">
            {buyerSuggestions.map((b) => (
              <li key={b.id}>
                <button type="button" onClick={() => pick(b)} className="flex min-h-11 w-full flex-col items-start border-b border-line px-4 py-2 text-left last:border-b-0">
                  <span className="text-base text-ink">{b.name}</span>
                  <span className={ui.muted}>{[b.instagram && `@${b.instagram}`, b.phone].filter(Boolean).join(" · ")}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1">
            <span className={card.label}>{t("phone")}</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" inputMode="tel" className={ui.input} />
          </label>
          <label className="flex flex-col gap-1">
            <span className={card.label}>Instagram</span>
            <input value={instagram} onChange={(e) => setInstagram(e.target.value)} autoCapitalize="none" placeholder="@" className={ui.input} />
          </label>
        </div>
        {!buyerId && <p className={ui.muted}>{t("buyerApart")}</p>}
      </section>

      <section className={`${card.surface} flex flex-col gap-3 p-4`}>
        <h2 className={card.heading}>{t("products")}</h2>
        <p className={ui.muted}>
          {rate ? (rate.source === "own" ? t("rateOwn", { rate: num(rate.rate) }) : t("rateNbp", { rate: num(rate.rate), date: rate.date ? formatIsoDate(rate.date) : "—" })) : t("rateUnknown")}
        </p>
        {lines.length > 0 && (
          <ul className="flex flex-col">
            {lines.map((l, n) => {
              const p = byId.get(l.productId);
              // MG10: the stock is shared out over the lines in order; what is left over is «Нужно заказать».
              const before = lines.slice(0, n).filter((x) => x.productId === l.productId).reduce((s, x) => s + (Number(x.quantity) || 0), 0);
              const missing = Math.max(0, (Number(l.quantity) || 0) - Math.max(0, (p?.stock ?? 0) - before));
              return (
                <li key={l.key} className="flex flex-col gap-2 border-t border-line py-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="min-w-0 break-words text-base font-semibold text-ink">
                      {p?.name ?? "—"}
                      {p?.size && <span className="font-normal text-muted"> · {p.size}</span>}
                    </span>
                    <button type="button" aria-label={t("removeLine", { name: p?.name ?? "" })} onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} className="flex size-11 shrink-0 items-center justify-center text-muted">
                      ✕
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex flex-col gap-1">
                      <span className={card.label}>{t("quantity")}</span>
                      <input value={l.quantity} onChange={(e) => change(l.key, { quantity: e.target.value })} inputMode="numeric" className={ui.input} />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className={card.label}>{t("priceZl")}</span>
                      <input value={l.price} onChange={(e) => change(l.key, { price: e.target.value })} inputMode="decimal" className={ui.input} />
                    </label>
                  </div>
                  <span className={ui.muted}>
                    {t("inStock", { count: p?.stock ?? 0 })}
                    {p?.currency === "EUR" && ` · ${t("catalogEur", { price: num(p.price) })}`}
                  </span>
                  {errors.lines?.[n] && <p className={ui.error}>{t(`errors.${errors.lines[n]}`)}</p>}
                  {missing > 0 && <p className="text-sm font-semibold text-accent">{t("needToOrder", { count: missing })}</p>}
                </li>
              );
            })}
          </ul>
        )}
        {errors.items && <p className={ui.error}>{t("errors.items")}</p>}
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("addProduct")} aria-label={t("addProduct")} className={ui.input} />
        {productResults.length > 0 && (
          <ul className="flex flex-col rounded-[14px] border border-field">
            {productResults.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => add(p)} className="flex min-h-11 w-full items-center justify-between gap-3 border-b border-line px-4 py-2 text-left last:border-b-0">
                  <span className="min-w-0">
                    <span className="block text-base text-ink">{p.name}</span>
                    <span className={ui.muted}>
                      {[p.brand, p.size, t("inStock", { count: p.stock })].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold text-accent">+ {t("add")}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="border-t border-line pt-3 text-lg font-semibold text-ink">
          {t("total")}: {t("pieces", { count: total.pieces })} · {zl(total.value)}
        </p>
      </section>

      {errors.failed && <p className={ui.error}>{t("failed")}</p>}
      <button type="button" onClick={save} disabled={pending} className={ui.button}>
        {t("save")}
      </button>

      {order && (
        <button type="button" onClick={() => setConfirmCancel(true)} className="min-h-11 rounded-[14px] bg-alert px-4 text-base font-semibold text-on-alert">
          {t("cancelOrder")}
        </button>
      )}
      {confirmCancel && order && (
        <div role="alertdialog" aria-label={t("cancelOrder")} className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-w-2xl flex-col gap-3 rounded-t-[18px] bg-alert p-4 pb-[calc(1rem+var(--safe-bottom))] text-on-alert shadow-lg">
          <p className="text-base">{t("cancelConfirm")}</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setConfirmCancel(false)} className="min-h-11 rounded-[14px] border border-current px-3 text-sm">
              {t("keep")}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const { ok } = await cancelOrderAction(order.id);
                  if (!ok) setErrors({ failed: true });
                  setConfirmCancel(false);
                })
              }
              className="min-h-11 rounded-[14px] bg-on-alert px-3 text-sm font-semibold text-alert disabled:opacity-50"
            >
              {t("cancelYes")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
