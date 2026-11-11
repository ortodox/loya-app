"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { card, ui } from "@/app/components/ui";
import { formatIsoDate } from "@/logic/rules/dates";
import type { OrderView } from "@/logic/usecases/shop-orders";
import { addPaymentAction, deletePaymentAction, handOverOrderAction } from "./order-actions";
import { BuyerContacts } from "./BuyerContacts";

/** MG9/MG12: one order – buyer, all products together, total in zł, «Выдан ✓» / «Изменить». */
export function OrderCard({ order, locale, today, highlight = false }: { order: OrderView; locale: string; today: string; highlight?: boolean }) {
  const t = useTranslations("shop.orders");
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);
  const [paying, setPaying] = useState(false);
  const [amount, setAmount] = useState("");
  const [removing, setRemoving] = useState<string | null>(null);
  // MG15: after «Сохранить» the page scrolls to the new order.
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (highlight) ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlight]);
  const missing = order.lines.some((l) => l.missing > 0);
  // MG15: red frame – not paid; yellow – partly paid, waiting for hand-over or for stock; thin – done.
  const frame =
    order.payment.status === "unpaid"
      ? "border-2 border-on-alert"
      : order.payment.status === "partial" || !order.handedOverOn || missing
        ? "border-2 border-warn-line"
        : "border border-line";
  const badge = "inline-flex min-h-8 items-center rounded-full px-3 text-sm font-semibold";
  const zl = (v: number) => new Intl.NumberFormat(locale, { style: "currency", currency: "PLN", currencyDisplay: "narrowSymbol", maximumFractionDigits: 2 }).format(v);
  const handOver = (handed: boolean) =>
    startTransition(async () => {
      setFailed(false);
      const { ok } = await handOverOrderAction(order.id, handed);
      if (!ok) setFailed(true);
    });

  return (
    <article ref={ref} id={`order-${order.id}`} className={`${card.surface} ${frame} flex flex-col gap-3 p-4 ${highlight ? "ring-4 ring-warn" : ""}`}>
      <header className="flex flex-col gap-1">
        <Link href={`/shop?view=orders&buyer=${order.buyer.id}`} className="text-lg font-semibold text-ink underline-offset-2 hover:underline">
          {order.buyer.name}
          {order.buyer.instagram && <span className="font-normal text-muted"> · @{order.buyer.instagram}</span>}
        </Link>
        <span className={ui.muted}>
          {formatIsoDate(order.orderedOn)}
          {order.orderedOn === today && <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-on-primary">{t("new")}</span>}
        </span>
        <div className="flex flex-wrap gap-2 pt-1">
          <span
            className={`${badge} ${order.payment.status === "unpaid" ? "bg-alert text-on-alert" : order.payment.status === "partial" ? "bg-warn text-on-warn" : "border border-field text-muted"}`}
          >
            💳 {order.payment.status === "paid" ? t("badgePaid") : t(order.payment.status === "unpaid" ? "badgeUnpaid" : "badgePartial", { left: zl(order.payment.left) })}
          </span>
          <span className={`${badge} ${order.handedOverOn ? "border border-field text-muted" : "bg-warn text-on-warn"}`}>
            📦 {order.handedOverOn ? t("handedOn", { date: formatIsoDate(order.handedOverOn) }) : t("waitingShort")}
          </span>
        </div>
      </header>
      <ul className="flex flex-col">
        {order.lines.map((l) => (
          <li key={l.id} className="flex items-baseline justify-between gap-3 border-t border-line py-2 text-base">
            <span className="min-w-0 break-words text-ink">
              {l.name}
              {l.size && <span className="text-muted"> · {l.size}</span>}
            </span>
            <span className="shrink-0 text-right text-ink">
              {t("pieces", { count: l.quantity })} · {zl(l.price * l.quantity)}
              {l.missing > 0 && <span className="mt-1 block rounded-[10px] border-2 border-warn-line bg-warn px-2 py-0.5 text-sm font-semibold text-on-warn">{t("needToOrder", { count: l.missing })}</span>}
            </span>
          </li>
        ))}
      </ul>
      <p className="border-t border-line pt-2 text-base font-semibold text-ink">
        {t("total")}: {t("pieces", { count: order.total.pieces })} · {zl(order.total.value)}
      </p>
      {/* MG11: payments – «Оплачено 500 zł из 1 330 zł», each can be taken back. */}
      <div className="flex flex-col gap-1">
        {order.payment.status !== "unpaid" && <span className="text-sm text-ink">{t("paidOf", { paid: zl(order.payment.paid), total: zl(order.total.value) })}</span>}
        {order.payment.left > 0 && <span className="text-lg font-semibold text-on-alert">{t("leftToPay", { left: zl(order.payment.left) })}</span>}
        {order.payments.map((p) => (
          <span key={p.id} className="flex items-center justify-between gap-2 text-sm text-muted">
            {formatIsoDate(p.paidOn)} · {zl(p.amount)}
            {removing === p.id ? (
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const { ok } = await deletePaymentAction(p.id);
                    setFailed(!ok);
                    setRemoving(null);
                  })
                }
                className="inline-flex min-h-11 items-center text-sm font-semibold text-on-alert"
              >
                {t("removePaymentSure")}
              </button>
            ) : (
              <button type="button" onClick={() => setRemoving(p.id)} className="inline-flex min-h-11 items-center text-sm text-on-alert">
                {t("removePayment")}
              </button>
            )}
          </span>
        ))}
        {paying ? (
          <div className="flex flex-col gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-sm text-muted">{t("paymentAmount")}</span>
              <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className={ui.input} />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setPaying(false)} className="min-h-11 rounded-[14px] border border-field px-3 text-base text-ink">
                {t("cancel")}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const { ok } = await addPaymentAction(order.id, amount);
                    setFailed(!ok);
                    if (ok) setPaying(false);
                  })
                }
                className={ui.button}
              >
                {t("save")}
              </button>
            </div>
          </div>
        ) : (
          order.payment.status !== "paid" && (
            <button
              type="button"
              onClick={() => {
                setAmount(String(order.payment.left).replace(".", ","));
                setPaying(true);
              }}
              className="flex min-h-11 w-full items-center justify-center rounded-[14px] border-2 border-on-alert px-4 text-base font-semibold text-on-alert"
            >
              💳 {t("payment")}
            </button>
          )
        )}
      </div>
      <BuyerContacts buyer={order.buyer} />
      {failed && <p className={ui.error}>{t("failed")}</p>}
      {order.handedOverOn ? (
        <button type="button" disabled={pending} onClick={() => handOver(false)} className={`${ui.textButton} self-start text-sm disabled:opacity-50`}>
          {t("undoHandOver")}
        </button>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Link href={`/shop/orders/${order.id}/edit`} className="flex min-h-11 items-center justify-center rounded-[14px] border border-field px-3 text-base text-ink">
            {t("edit")}
          </Link>
          <button type="button" disabled={pending || !order.canHandOver} onClick={() => handOver(true)} className={ui.button}>
            {t("handOver")}
          </button>
        </div>
      )}
      {!order.handedOverOn && !order.canHandOver && <p className={ui.muted}>{t("waitsForStock")}</p>}
    </article>
  );
}
