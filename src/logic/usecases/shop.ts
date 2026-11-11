import type { IsoDate } from "@/logic/client";
import { isIsoDate } from "@/logic/rules/dates";
import { isMonth, monthOf } from "@/logic/rules/consumption";
import { shopGoesNegative, shopHistory, shopMovementKinds, shopSales, shopStock, sortShopProducts, type ShopHistoryLine, type ShopMovementKind, type ShopProduct, type ShopSales } from "@/logic/rules/shop";
import type { ShopProductInput, ShopRepository } from "@/data/repositories/shop";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** MG1/MG2: a product with what is in stock and its «История». */
export type ShopLine = ShopProduct & { stock: number; history: ShopHistoryLine[] };

/** MG1/MG2 «Магазин»: the products Loya sells (⭐ first), with stock and history; hidden products are left out. */
export async function getShop(repo: ShopRepository): Promise<{ lines: ShopLine[]; brands: string[] }> {
  const [products, movements] = await Promise.all([repo.listProducts(), repo.listMovements()]);
  const stock = shopStock(movements);
  const lines = sortShopProducts(products.filter((p) => p.active)).map((p) => ({ ...p, stock: stock.get(p.id) ?? 0, history: shopHistory(movements, p.id) }));
  return { lines, brands: [...new Set(lines.map((l) => l.brand))].sort() };
}

/**
 * MG2/MG6/MG7: «+» (one came in) or «−» – sold (keeps today's price, counts in «Продажи») or a correction
 * (stock only). «−» only while there is something in stock.
 */
export async function tapShopProduct(repo: ShopRepository, productId: string, kind: ShopMovementKind, today: IsoDate): Promise<boolean> {
  if (!uuid.test(productId) || !shopMovementKinds.includes(kind)) return false;
  const product = await repo.getProduct(productId);
  if (!product) return false;
  if (kind !== "receipt" && (shopStock(await repo.listMovements()).get(productId) ?? 0) <= 0) return false;
  await repo.addMovement({
    productId,
    happenedOn: today,
    kind,
    quantity: 1,
    price: kind === "sale" ? product.price : null,
    currency: kind === "sale" ? product.currency : null,
  });
  return true;
}

/**
 * MG2/MG7: «Удалить» a line of «История» (all movements of that kind on that day) – refused ("negative")
 * when it would leave more sold than came in.
 */
export async function deleteShopHistoryLine(repo: ShopRepository, productId: string, date: string, kind: string): Promise<"ok" | "negative" | "invalid"> {
  if (!uuid.test(productId) || !isIsoDate(date) || !shopMovementKinds.includes(kind as ShopMovementKind)) return "invalid";
  const movements = await repo.listMovements();
  const left = movements.filter((m) => !(m.productId === productId && m.happenedOn === date && m.kind === kind && !m.orderItemId));
  if (shopGoesNegative(left, productId) && !shopGoesNegative(movements, productId)) return "negative";
  return (await repo.deleteMovements(productId, date, kind as ShopMovementKind)) > 0 ? "ok" : "invalid";
}

/** MG4: ⭐ on and off. */
export async function toggleShopFavorite(repo: ShopRepository, productId: string): Promise<boolean> {
  if (!uuid.test(productId)) return false;
  const product = await repo.getProduct(productId);
  if (!product) return false;
  return repo.setFavorite(productId, !product.favorite);
}

/** MG3/MG9 «Продажи»: the month asked for (current month when missing or invalid); order rows name the buyer. */
export async function getShopSales(
  repo: ShopRepository,
  month: string | undefined,
  today: IsoDate,
  orders?: { listOrders(): Promise<{ id: string; buyerId: string; handedOverOn: string | null; items: { id: string }[] }[]>; listBuyers(): Promise<{ id: string; name: string }[]> },
): Promise<{ sales: ShopSales; products: ShopProduct[]; orders: Record<string, { buyerId: string; buyerName: string; handed: boolean }> }> {
  const [products, movements, list, buyers] = await Promise.all([repo.listProducts(), repo.listMovements(), orders?.listOrders() ?? [], orders?.listBuyers() ?? []]);
  const current = monthOf(today);
  const chosen = month && isMonth(month) && month <= current ? month : current;
  const orderOfItem = new Map(list.flatMap((o) => o.items.map((i) => [i.id, o.id] as const)));
  const names = new Map(buyers.map((b) => [b.id, b.name]));
  const info = Object.fromEntries(list.map((o) => [o.id, { buyerId: o.buyerId, buyerName: names.get(o.buyerId) ?? "—", handed: Boolean(o.handedOverOn) }]));
  return { sales: shopSales(movements, products, chosen, orderOfItem), products, orders: info };
}

/**
 * MG13 «Исправить» in «Продажи» → «Да»: the newest sale of the product in that month made in «Склад» (not
 * from an order) goes back to stock – kept in «История» with «Возврат +1» today, gone from «Продажи».
 */
export async function returnShopSale(repo: ShopRepository, productId: string, month: string, currency: string, today: IsoDate): Promise<boolean> {
  if (!uuid.test(productId) || !isMonth(month) || (currency !== "PLN" && currency !== "EUR")) return false;
  const sale = (await repo.listMovements())
    .filter((m) => m.productId === productId && m.kind === "sale" && !m.orderItemId && !m.returnedOn && m.happenedOn.slice(0, 7) === month && (m.currency ?? currency) === currency)
    .sort((a, b) => b.happenedOn.localeCompare(a.happenedOn) || b.createdAt.localeCompare(a.createdAt))[0];
  if (!sale) return false;
  return repo.markReturned(sale.id, today);
}

export type ShopProductForm = { brand?: string; category?: string; name?: string; size?: string; currency?: string; price?: string; favorite?: string; hidden?: string };
export type ShopProductErrors = Partial<Record<"brand" | "name" | "price" | "currency", "required" | "invalid">>;

/** MG1 «+ Товар» / «Изменить»: name and brand required; the price is Loya's own (≥ 0). */
export async function saveShopProduct(
  repo: ShopRepository,
  id: string | null,
  form: ShopProductForm,
): Promise<{ ok: true; id: string } | { ok: false; errors: ShopProductErrors } | { ok: false; notFound: true }> {
  const errors: ShopProductErrors = {};
  const brand = (form.brand ?? "").trim().slice(0, 80);
  const name = (form.name ?? "").trim().slice(0, 200);
  const price = Number((form.price ?? "").trim().replace(",", ".").replace(/\s/g, ""));
  const currency = form.currency === "EUR" ? "EUR" : form.currency === "PLN" ? "PLN" : null;
  if (!brand) errors.brand = "required";
  if (!name) errors.name = "required";
  if ((form.price ?? "").trim() === "" || !Number.isFinite(price) || price < 0 || price > 1_000_000) errors.price = "invalid";
  if (!currency) errors.currency = "invalid";
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  const input: ShopProductInput = {
    brand,
    name,
    category: (form.category ?? "").trim().slice(0, 80),
    size: (form.size ?? "").trim().slice(0, 40),
    currency: currency!,
    price: Math.round(price * 100) / 100,
    favorite: form.favorite === "on",
    active: form.hidden !== "on",
  };
  if (id === null) return { ok: true, ...(await repo.createProduct(input)) };
  if (!uuid.test(id) || !(await repo.updateProduct(id, input))) return { ok: false, notFound: true };
  return { ok: true, id };
}
