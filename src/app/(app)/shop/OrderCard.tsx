"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState, useTransition } from "react";
import { card, ui } from "@/app/components/ui";
import { formatIsoDate } from "@/logic/rules/dates";
import type { OrderView } from "@/logic/usecases/shop-orders";
import { handOverOrderAction } from "./order-actions";
import { BuyerContacts } from "./BuyerContacts";

/** MG9/MG12: one order – buyer, all products together, total in zł, «Выдан ✓» / «Изменить». */
export function OrderCard({ order, locale }: { order: OrderView; locale: string }) {
  const t = useTranslations("shop.orders");
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);
  const zl = (v: number) => new Intl.NumberFormat(locale, { style: "currency", currency: "PLN", currencyDisplay: "narrowSymbol", maximumFractionDigits: 2 }).format(v);
  const handOver = (handed: boolean) =>
    startTransition(async () => {
      setFailed(false);
      const { ok } = await handOverOrderAction(order.id, handed);
      if (!ok) setFailed(true);
    });

  return (
    <article className={`${card.surface} flex flex-col gap-3 p-4`}>
      <header className="flex flex-col gap-0.5">
        <Link href={`/shop?view=orders&buyer=${order.buyer.id}`} className="text-lg font-semibold text-ink underline-offset-2 hover:underline">
          {order.buyer.name}
          {order.buyer.instagram && <span className="font-normal text-muted"> · @{order.buyer.instagram}</span>}
        </Link>
        <span className={ui.muted}>
          {formatIsoDate(order.orderedOn)} · {order.handedOverOn ? t("handedOn", { date: formatIsoDate(order.handedOverOn) }) : t("waitingShort")}
        </span>
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
            </span>
          </li>
        ))}
      </ul>
      <p className="border-t border-line pt-2 text-base font-semibold text-ink">
        {t("total")}: {t("pieces", { count: order.total.pieces })} · {zl(order.total.value)}
      </p>
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
          <button type="button" disabled={pending} onClick={() => handOver(true)} className={ui.button}>
            {t("handOver")}
          </button>
        </div>
      )}
    </article>
  );
}
