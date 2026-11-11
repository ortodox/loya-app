import type { IsoDate } from "@/logic/client";

/** MG1: a cosmetics product Loya sells (Medik8, Instytutum …). Wholesale and margin are kept, not shown. */
export type ShopProduct = {
  id: string;
  brand: string;
  category: string;
  name: string;
  size: string;
  currency: "PLN" | "EUR";
  price: number;
  favorite: boolean;
  active: boolean;
  sortOrder: number;
};

/** MG2/MG6: «+» (delivery), «−» sold (sale, keeps its price) or «−» correction (not a sale). */
export type ShopMovementKind = "sale" | "receipt" | "correction";
export const shopMovementKinds: readonly ShopMovementKind[] = ["sale", "receipt", "correction"];

/** MG2: «−» (sale) or «+» (delivery); a sale keeps the price it was sold for. */
export type ShopMovement = {
  id: string;
  productId: string;
  happenedOn: IsoDate;
  kind: ShopMovementKind;
  quantity: number;
  price: number | null;
  currency: "PLN" | "EUR" | null;
  createdAt: string;
  /** MG9: the order line this sale belongs to (removed with the order); null/missing = a tap in «Склад». */
  orderItemId?: string | null;
  /** MG13: «Исправить» in «Продажи» – the sale was given back to stock on this day (null = not returned). */
  returnedOn?: IsoDate | null;
  returnedAt?: string | null;
};

/** What happened to a product, in order: a movement, and for a returned sale also «Возврат +N» later. */
type ShopEvent = { productId: string; date: IsoDate; at: string; delta: number; kind: ShopMovementKind | "order" | "return"; quantity: number };

function shopEvents(movements: readonly ShopMovement[]): ShopEvent[] {
  const events: ShopEvent[] = [];
  for (const m of movements) {
    // MG9: sales from orders are their own kind («Заказ −2») – changed in the order, not in «История».
    const kind = m.orderItemId ? "order" : m.kind;
    events.push({ productId: m.productId, date: m.happenedOn, at: m.createdAt, delta: m.kind === "receipt" ? m.quantity : -m.quantity, kind, quantity: m.quantity });
    if (m.returnedOn) events.push({ productId: m.productId, date: m.returnedOn, at: m.returnedAt ?? m.createdAt, delta: m.quantity, kind: "return", quantity: m.quantity });
  }
  return events.sort((a, b) => a.date.localeCompare(b.date) || a.at.localeCompare(b.at));
}

/** MG2/MG7/MG13: what is in stock per product – deliveries and returns minus sales and corrections, never below zero. */
export function shopStock(movements: readonly ShopMovement[]): Map<string, number> {
  const stock = new Map<string, number>();
  for (const e of shopEvents(movements)) stock.set(e.productId, Math.max(0, (stock.get(e.productId) ?? 0) + e.delta));
  return stock;
}

/** MG7: true when these movements of one product would at some point take more out than there is. */
export function shopGoesNegative(movements: readonly ShopMovement[], productId: string): boolean {
  let balance = 0;
  for (const e of shopEvents(movements.filter((x) => x.productId === productId))) {
    balance += e.delta;
    if (balance < 0) return true;
  }
  return false;
}

/** MG2: one line of «История» – all sales (deliveries, corrections, returns) of one day together, with what was left after. */
export type ShopHistoryLine = { date: IsoDate; kind: ShopMovementKind | "order" | "return"; quantity: number; balance: number };

/** MG2/MG13: the history of one product, newest first; the same kind on the same day is one line. */
export function shopHistory(movements: readonly ShopMovement[], productId: string): ShopHistoryLine[] {
  const lines: ShopHistoryLine[] = [];
  let balance = 0;
  for (const e of shopEvents(movements.filter((m) => m.productId === productId))) {
    balance = Math.max(0, balance + e.delta);
    const last = lines[lines.length - 1];
    if (last && last.date === e.date && last.kind === e.kind) {
      last.quantity += e.quantity;
      last.balance = balance;
    } else lines.push({ date: e.date, kind: e.kind, quantity: e.quantity, balance });
  }
  return lines.reverse();
}

/** MG3: what was sold in a month («2026-11») – per product, and the value per currency. */
export type ShopSales = {
  month: string;
  pieces: number;
  value: { PLN: number; EUR: number };
  /** orderId: sales of one order (MG9, changed in the order); null = taps in «Склад» (MG13 «Исправить»). */
  rows: { productId: string; quantity: number; value: number; currency: "PLN" | "EUR"; orderId: string | null }[];
};

/** MG3/MG9/MG13: returned sales do not count; sales of an order are their own row (orderOfItem: order line → order). */
export function shopSales(movements: readonly ShopMovement[], products: readonly ShopProduct[], month: string, orderOfItem: ReadonlyMap<string, string> = new Map()): ShopSales {
  const byId = new Map(products.map((p) => [p.id, p]));
  const rows = new Map<string, ShopSales["rows"][number]>();
  const value = { PLN: 0, EUR: 0 };
  let pieces = 0;
  for (const m of movements) {
    if (m.kind !== "sale" || m.returnedOn || m.happenedOn.slice(0, 7) !== month) continue;
    const product = byId.get(m.productId);
    const currency = m.currency ?? product?.currency ?? "PLN";
    const amount = (m.price ?? product?.price ?? 0) * m.quantity;
    // One row per product, currency and order: an Instytutum order is in zł, a tap in «Склад» in €.
    const orderId = m.orderItemId ? (orderOfItem.get(m.orderItemId) ?? m.orderItemId) : null;
    const key = `${m.productId}:${currency}:${orderId ?? ""}`;
    const row = rows.get(key) ?? { productId: m.productId, quantity: 0, value: 0, currency, orderId };
    row.quantity += m.quantity;
    row.value = Math.round((row.value + amount) * 100) / 100;
    rows.set(key, row);
    value[currency] = Math.round((value[currency] + amount) * 100) / 100;
    pieces += m.quantity;
  }
  return { month, pieces, value, rows: [...rows.values()].sort((a, b) => b.quantity - a.quantity) };
}

/** MG1/MG4: ⭐ first, then by brand, category and the order of the price list. */
export function sortShopProducts<T extends ShopProduct>(products: readonly T[]): T[] {
  return [...products].sort(
    (a, b) =>
      Number(b.favorite) - Number(a.favorite) ||
      a.brand.localeCompare(b.brand) ||
      a.sortOrder - b.sortOrder ||
      a.name.localeCompare(b.name),
  );
}

/**
 * MG5 «Склад»: first one list of what is in stock – most first, then brand and name; below it ⭐ (not in
 * stock), then the rest in the catalogue order.
 */
export function shopStockSections<T extends ShopProduct & { stock: number }>(lines: readonly T[]): { inStock: T[]; favorites: T[]; rest: T[] } {
  const inStock = lines
    .filter((l) => l.stock > 0)
    .sort((a, b) => b.stock - a.stock || a.brand.localeCompare(b.brand) || a.name.localeCompare(b.name));
  const others = lines.filter((l) => l.stock <= 0);
  return { inStock, favorites: others.filter((l) => l.favorite), rest: others.filter((l) => !l.favorite) };
}

/** MG1: search in name, size, category and brand; brand filter («Все» = null). */
export function matchesShopFilter(product: ShopProduct, query: string, brand: string | null): boolean {
  if (brand && product.brand !== brand) return false;
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [product.name, product.size, product.category, product.brand].some((s) => s.toLowerCase().includes(q));
}
