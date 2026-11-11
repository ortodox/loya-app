import type { IsoDate } from "@/logic/client";
import { shopStock, type ShopMovement, type ShopProduct } from "./shop";

/** MG9: someone who buys cosmetics – kept apart from clients. Phone and Instagram are optional. */
export type ShopBuyer = { id: string; name: string; phone: string; instagram: string };

/** MG9: one product in an order, price per piece in zł. */
export type ShopOrderItem = { id: string; productId: string; quantity: number; price: number };

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

/** MG12 «Заказы»: waiting first (oldest on top), then handed over (newest on top). */
export function orderSections<T extends Pick<ShopOrder, "orderedOn" | "createdAt" | "handedOverOn">>(orders: readonly T[]): { waiting: T[]; handed: T[] } {
  const byDate = (a: T, b: T) => a.orderedOn.localeCompare(b.orderedOn) || a.createdAt.localeCompare(b.createdAt);
  return {
    waiting: orders.filter((o) => !o.handedOverOn).sort(byDate),
    handed: orders.filter((o) => o.handedOverOn).sort((a, b) => byDate(b, a)),
  };
}

/**
 * MG9/MG7: what an order may take of each product – the stock without this order's own sales (when it is
 * being changed). Returns the products asked for more than there is, with what is there.
 */
export function orderShortages(
  movements: readonly ShopMovement[],
  wanted: readonly { productId: string; quantity: number }[],
  ownItemIds: ReadonlySet<string>,
): Map<string, number> {
  const stock = shopStock(movements.filter((m) => !(m.orderItemId && ownItemIds.has(m.orderItemId))));
  const asked = new Map<string, number>();
  for (const w of wanted) asked.set(w.productId, (asked.get(w.productId) ?? 0) + w.quantity);
  const short = new Map<string, number>();
  for (const [productId, quantity] of asked) {
    const have = stock.get(productId) ?? 0;
    if (quantity > have) short.set(productId, have);
  }
  return short;
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
