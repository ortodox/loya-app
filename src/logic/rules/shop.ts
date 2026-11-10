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

/** MG2: «−» (sale) or «+» (delivery); a sale keeps the price it was sold for. */
export type ShopMovement = {
  id: string;
  productId: string;
  happenedOn: IsoDate;
  kind: "sale" | "receipt";
  quantity: number;
  price: number | null;
  currency: "PLN" | "EUR" | null;
  createdAt: string;
};

/** MG2: what is in stock per product – deliveries minus sales (can go below zero, shown in red). */
export function shopStock(movements: readonly ShopMovement[]): Map<string, number> {
  const stock = new Map<string, number>();
  for (const m of movements) stock.set(m.productId, (stock.get(m.productId) ?? 0) + (m.kind === "receipt" ? m.quantity : -m.quantity));
  return stock;
}

/** MG2: one line of «История» – all sales (or deliveries) of one day together, with what was left after. */
export type ShopHistoryLine = { date: IsoDate; kind: "sale" | "receipt"; quantity: number; balance: number };

/** MG2: the history of one product, newest first; taps of the same kind on the same day are one line. */
export function shopHistory(movements: readonly ShopMovement[], productId: string): ShopHistoryLine[] {
  const own = movements
    .filter((m) => m.productId === productId)
    .sort((a, b) => a.happenedOn.localeCompare(b.happenedOn) || a.createdAt.localeCompare(b.createdAt));
  const lines: ShopHistoryLine[] = [];
  let balance = 0;
  for (const m of own) {
    balance += m.kind === "receipt" ? m.quantity : -m.quantity;
    const last = lines[lines.length - 1];
    if (last && last.date === m.happenedOn && last.kind === m.kind) {
      last.quantity += m.quantity;
      last.balance = balance;
    } else lines.push({ date: m.happenedOn, kind: m.kind, quantity: m.quantity, balance });
  }
  return lines.reverse();
}

/** MG3: what was sold in a month («2026-11») – per product, and the value per currency. */
export type ShopSales = {
  month: string;
  pieces: number;
  value: { PLN: number; EUR: number };
  rows: { productId: string; quantity: number; value: number; currency: "PLN" | "EUR" }[];
};

export function shopSales(movements: readonly ShopMovement[], products: readonly ShopProduct[], month: string): ShopSales {
  const byId = new Map(products.map((p) => [p.id, p]));
  const rows = new Map<string, { productId: string; quantity: number; value: number; currency: "PLN" | "EUR" }>();
  const value = { PLN: 0, EUR: 0 };
  let pieces = 0;
  for (const m of movements) {
    if (m.kind !== "sale" || m.happenedOn.slice(0, 7) !== month) continue;
    const product = byId.get(m.productId);
    const currency = m.currency ?? product?.currency ?? "PLN";
    const amount = (m.price ?? product?.price ?? 0) * m.quantity;
    const row = rows.get(m.productId) ?? { productId: m.productId, quantity: 0, value: 0, currency };
    row.quantity += m.quantity;
    row.value = Math.round((row.value + amount) * 100) / 100;
    rows.set(m.productId, row);
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

/** MG1: search in name, size, category and brand; brand filter («Все» = null). */
export function matchesShopFilter(product: ShopProduct, query: string, brand: string | null): boolean {
  if (brand && product.brand !== brand) return false;
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [product.name, product.size, product.category, product.brand].some((s) => s.toLowerCase().includes(q));
}
