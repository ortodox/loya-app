import type { IsoDate } from "@/logic/client";
import { shopStock, type ShopMovement, type ShopProduct } from "./shop";

/** MG9: someone who buys cosmetics – kept apart from clients. Phone and Instagram are optional. */
export type ShopBuyer = { id: string; name: string; phone: string; instagram: string };

/**
 * MG9: one product in an order, price per piece in zł; MG10: «missing» pieces wait for a delivery.
 * MG22: the purchase price of the day the line was saved, in the product's currency (null = not known).
 */
export type ShopOrderItem = {
  id: string;
  productId: string;
  quantity: number;
  price: number;
  missing: number;
  purchasePrice?: number | null;
  purchaseCurrency?: "PLN" | "EUR" | null;
};

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
  /** MG21: «−10 %» … «−40 %» on the whole order (null = none). */
  discountPercent?: number | null;
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

/** MG21: the discount buttons on an order. */
export const discountChoices = [10, 20, 30, 40] as const;

/** MG21: a discount the order may keep – 1–99 %; anything else is no discount. */
export const validDiscount = (p: unknown): number | null => (typeof p === "number" && Number.isInteger(p) && p >= 1 && p <= 99 ? p : null);

/**
 * MG9: pieces and value (zł) of an order. MG21: with a discount, «value» is the total after it, rounded to
 * whole zł (530 → −20 % → 424), and «before» the total before it.
 */
export function orderTotal(items: readonly Pick<ShopOrderItem, "quantity" | "price">[], discountPercent?: number | null): { pieces: number; value: number; before: number } {
  let pieces = 0;
  let value = 0;
  for (const i of items) {
    pieces += i.quantity;
    value += i.quantity * i.price;
  }
  const before = Math.round(value * 100) / 100;
  const discount = validDiscount(discountPercent);
  return { pieces, value: discount ? Math.round((before * (100 - discount)) / 100) : before, before };
}

/**
 * MG20/MG22: what of the money goes back into buying the products again («Отложить на закупку») and what is
 * Loya's own («Твоя прибыль»), in zł. Only pieces with a purchase price kept at the time of the sale are
 * counted; the others are «uncounted» (pieces). € (Instytutum) by the rate given.
 */
export type ProfitSplit = { cost: number; profit: number; uncounted: number };

const round2 = (v: number) => Math.round(v * 100) / 100;
const inZl = (amount: number, currency: "PLN" | "EUR" | null | undefined, rate: number | null) =>
  currency === "EUR" ? (rate && rate > 0 ? amount * rate : null) : amount;

function addSplit(a: ProfitSplit, b: ProfitSplit): ProfitSplit {
  return { cost: round2(a.cost + b.cost), profit: round2(a.profit + b.profit), uncounted: a.uncounted + b.uncounted };
}

/** MG22: one order – the discount lowers the profit only; the purchase price of € products by the order's rate. */
export function orderProfit(order: Pick<ShopOrder, "items" | "discountPercent" | "eurRate">): ProfitSplit {
  const total = orderTotal(order.items, order.discountPercent);
  const share = total.before > 0 ? total.value / total.before : 1;
  let cost = 0;
  let income = 0;
  let uncounted = 0;
  for (const i of order.items) {
    const unit = i.purchasePrice == null ? null : inZl(i.purchasePrice, i.purchaseCurrency, order.eurRate);
    if (unit === null) {
      uncounted += i.quantity;
      continue;
    }
    cost += i.quantity * unit;
    income += i.quantity * i.price * share;
  }
  return { cost: round2(cost), profit: round2(income - cost), uncounted };
}

/**
 * MG20 «Итог» in «Продажи»: the month's sales in «Склад» (not returned; € by today's rate) and the month's
 * orders (on the order day, as orderSales counts them).
 */
export function monthProfit(movements: readonly ShopMovement[], orders: readonly ShopOrder[], month: string, eurRate: number | null): ProfitSplit {
  let split: ProfitSplit = { cost: 0, profit: 0, uncounted: 0 };
  for (const m of movements) {
    if (m.kind !== "sale" || m.orderItemId || m.returnedOn || m.happenedOn.slice(0, 7) !== month) continue;
    const unit = m.purchasePrice == null ? null : inZl(m.purchasePrice, m.purchaseCurrency, eurRate);
    const price = m.price === null ? null : inZl(m.price, m.currency, eurRate);
    if (unit === null || price === null) split = addSplit(split, { cost: 0, profit: 0, uncounted: m.quantity });
    else split = addSplit(split, { cost: m.quantity * unit, profit: m.quantity * (price - unit), uncounted: 0 });
  }
  for (const o of orders) if (o.orderedOn.slice(0, 7) === month) split = addSplit(split, orderProfit(o));
  return split;
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
    // MG21: a discount lowers every product of the order by the same share.
    const total = orderTotal(o.items, o.discountPercent);
    const share = total.before > 0 ? total.value / total.before : 1;
    for (const i of o.items) {
      const row = rows.find((r) => r.orderId === o.id && r.productId === i.productId);
      if (row) {
        row.quantity += i.quantity;
        row.value = Math.round((row.value + i.quantity * i.price * share) * 100) / 100;
      } else rows.push({ productId: i.productId, orderId: o.id, quantity: i.quantity, value: Math.round(i.quantity * i.price * share * 100) / 100 });
    }
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

/** MG16 «Кто ждёт»: one order that waits for a product – how many are put aside for it and how many are still missing. */
export type WaitEntry = {
  orderId: string;
  itemId: string;
  buyerName: string;
  orderedOn: IsoDate;
  paid: PaymentState["status"];
  reserved: number;
  missing: number;
};

/** MG16: per product, every order not handed over yet (paid or not), oldest first. */
export function whoWaits(orders: readonly (ShopOrder & { buyerName: string })[]): Map<string, WaitEntry[]> {
  const result = new Map<string, WaitEntry[]>();
  const open = orders.filter((o) => !o.handedOverOn).sort((a, b) => a.orderedOn.localeCompare(b.orderedOn) || a.createdAt.localeCompare(b.createdAt));
  for (const o of open) {
    const paid = paymentState(orderTotal(o.items, o.discountPercent).value, o.payments).status;
    for (const i of o.items) {
      const entry: WaitEntry = { orderId: o.id, itemId: i.id, buyerName: o.buyerName, orderedOn: o.orderedOn, paid, reserved: i.quantity - i.missing, missing: i.missing };
      result.set(i.productId, [...(result.get(i.productId) ?? []), entry]);
    }
  }
  return result;
}

/** MG16 «Кому отложить?»: the oldest orders that wait are ticked first, as many pieces as came in. */
export function preselect(entries: readonly WaitEntry[], count: number): Record<string, number> {
  const picked: Record<string, number> = {};
  let left = count;
  for (const e of entries) {
    if (left <= 0) break;
    if (e.missing <= 0) continue;
    const take = Math.min(e.missing, left);
    picked[e.itemId] = take;
    left -= take;
  }
  return picked;
}

/** MG17: a € amount in zł by the € rate, rounded to whole zł (as an order would price it); null without a rate. */
export function eurInZl(eur: number, rate: number | null): number | null {
  return rate && rate > 0 ? Math.round(eur * rate) : null;
}
