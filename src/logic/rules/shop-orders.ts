import type { IsoDate } from "@/logic/client";
import { shopStock, type ShopMovement, type ShopProduct } from "./shop";

/** MG9: someone who buys cosmetics – kept apart from clients. Phone and Instagram are optional. */
export type ShopBuyer = { id: string; name: string; phone: string; instagram: string };

/** MG9: one product in an order, price per piece in zł; MG10: «missing» pieces wait for a delivery. */
export type ShopOrderItem = { id: string; productId: string; quantity: number; price: number; missing: number };

/** MG11: money received for an order, in zł. */
export type ShopPayment = { id: string; amount: number; paidOn: IsoDate };

/** MG9/MG12: an order for one buyer, all in zł; handedOverOn = «Выдан ✓» (null = waiting). */
export type ShopOrder = {
  id: string;
  buyerId: string;
  orderedOn: IsoDate;
  eurRate: number | null;
  rateSource: "nbp" | "own" | null;
  handedOverOn: IsoDate | null;
  createdAt: string;
  items: ShopOrderItem[];
  payments: ShopPayment[];
};

/** MG9: the € rate an order uses – Loya's own when she has set one, else the NBP selling rate. */
export type EurRate = { rate: number; source: "nbp" | "own"; date: IsoDate | null };

export function effectiveRate(own: number | null, nbp: { rate: number; date: IsoDate } | null): EurRate | null {
  if (own && own > 0) return { rate: own, source: "own", date: null };
  if (nbp && nbp.rate > 0) return { rate: nbp.rate, source: "nbp", date: nbp.date };
  return null;
}

/** MG9: the price suggested in an order, in zł – € prices by the rate, rounded to whole zł (337,33 → 337). */
export function orderPrice(product: Pick<ShopProduct, "price" | "currency">, rate: EurRate | null): number | null {
  if (product.currency === "PLN") return product.price;
  return rate ? Math.round(product.price * rate.rate) : null;
}

/** MG9: pieces and value (zł) of an order. */
export function orderTotal(items: readonly Pick<ShopOrderItem, "quantity" | "price">[]): { pieces: number; value: number } {
  let pieces = 0;
  let value = 0;
  for (const i of items) {
    pieces += i.quantity;
    value += i.quantity * i.price;
  }
  return { pieces, value: Math.round(value * 100) / 100 };
}

/** MG11: how much is paid of the total – «Не оплачен», «Частично» or «Оплачен» (more than the total counts as paid). */
export type PaymentState = { paid: number; left: number; status: "unpaid" | "partial" | "paid" };

export function paymentState(total: number, payments: readonly Pick<ShopPayment, "amount">[]): PaymentState {
  const paid = Math.round(payments.reduce((s, p) => s + p.amount, 0) * 100) / 100;
  const left = Math.max(0, Math.round((total - paid) * 100) / 100);
  return { paid, left, status: left === 0 ? "paid" : paid > 0 ? "partial" : "unpaid" };
}

/**
 * MG12/MG11 «Заказы»: waiting for hand-over first (oldest on top), then handed over but not fully paid,
 * then done – handed over and paid (newest on top).
 */
export function orderSections<T extends Pick<ShopOrder, "orderedOn" | "createdAt" | "handedOverOn"> & { payment: PaymentState }>(
  orders: readonly T[],
): { waiting: T[]; unpaid: T[]; done: T[] } {
  const byDate = (a: T, b: T) => a.orderedOn.localeCompare(b.orderedOn) || a.createdAt.localeCompare(b.createdAt);
  return {
    waiting: orders.filter((o) => !o.handedOverOn).sort(byDate),
    unpaid: orders.filter((o) => o.handedOverOn && o.payment.status !== "paid").sort(byDate),
    done: orders.filter((o) => o.handedOverOn && o.payment.status === "paid").sort((a, b) => byDate(b, a)),
  };
}

/** MG10/MG12: an order can be handed over only when nothing is missing. */
export const canHandOver = (order: Pick<ShopOrder, "items">) => order.items.every((i) => i.missing === 0);

/**
 * MG10 «Нужно заказать»: how many pieces of each line are not in stock – the stock (without this order's own
 * sales) is shared out over the lines in order; what is left over is missing. Stock never goes below zero.
 */
export function orderMissing(
  movements: readonly ShopMovement[],
  lines: readonly { productId: string; quantity: number }[],
  ownItemIds: ReadonlySet<string>,
): number[] {
  const stock = shopStock(movements.filter((m) => !(m.orderItemId && ownItemIds.has(m.orderItemId))));
  return lines.map((l) => {
    const have = stock.get(l.productId) ?? 0;
    const taken = Math.min(have, l.quantity);
    stock.set(l.productId, have - taken);
    return l.quantity - taken;
  });
}

/** MG10: what waits for a delivery – per product, the orders (oldest first) with how many pieces they miss. */
export type WaitingLine = { orderId: string; itemId: string; buyerName: string; orderedOn: IsoDate; missing: number };

export function waitingForStock(orders: readonly (ShopOrder & { buyerName: string })[]): Map<string, WaitingLine[]> {
  const waiting = new Map<string, WaitingLine[]>();
  const open = orders.filter((o) => !o.handedOverOn).sort((a, b) => a.orderedOn.localeCompare(b.orderedOn) || a.createdAt.localeCompare(b.createdAt));
  for (const o of open)
    for (const i of o.items)
      if (i.missing > 0)
        waiting.set(i.productId, [...(waiting.get(i.productId) ?? []), { orderId: o.id, itemId: i.id, buyerName: o.buyerName, orderedOn: o.orderedOn, missing: i.missing }]);
  return waiting;
}

/** MG9/MG11 «Продажи»: the orders of a month – zł per product and order, and what is not paid yet. */
export function orderSales(orders: readonly ShopOrder[], month: string): { rows: { productId: string; orderId: string; quantity: number; value: number }[]; pieces: number; value: number; unpaid: number } {
  const rows: { productId: string; orderId: string; quantity: number; value: number }[] = [];
  let pieces = 0;
  let value = 0;
  let unpaid = 0;
  for (const o of orders) {
    if (o.orderedOn.slice(0, 7) !== month) continue;
    for (const i of o.items) {
      const row = rows.find((r) => r.orderId === o.id && r.productId === i.productId);
      if (row) {
        row.quantity += i.quantity;
        row.value = Math.round((row.value + i.quantity * i.price) * 100) / 100;
      } else rows.push({ productId: i.productId, orderId: o.id, quantity: i.quantity, value: Math.round(i.quantity * i.price * 100) / 100 });
    }
    const total = orderTotal(o.items);
    pieces += total.pieces;
    value += total.value;
    unpaid += paymentState(total.value, o.payments).left;
  }
  return { rows, pieces, value: Math.round(value * 100) / 100, unpaid: Math.round(unpaid * 100) / 100 };
}

/** MG9: «@anna.beauty», «instagram.com/anna.beauty/» → «anna.beauty»; empty when it is not a handle. */
export function instagramHandle(input: string): string {
  const h = input.trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/^@/, "").replace(/[/?#].*$/, "");
  return /^[A-Za-z0-9._]{1,30}$/.test(h) ? h : "";
}

export const instagramUrl = (handle: string) => `https://instagram.com/${handle}`;

/** MG9: buyers whose name, phone or Instagram contains what is typed (for the suggestions). */
export function matchesBuyer(buyer: ShopBuyer, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const digits = q.replace(/\D/g, "");
  return (
    buyer.name.toLowerCase().includes(q) ||
    buyer.instagram.toLowerCase().includes(q.replace(/^@/, "")) ||
    (digits.length >= 3 && buyer.phone.replace(/\D/g, "").includes(digits))
  );
}
