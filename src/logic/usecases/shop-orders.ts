import type { IsoDate } from "@/logic/client";
import type { ShopRepository } from "@/data/repositories/shop";
import type { ShopOrdersRepository } from "@/data/repositories/shop-orders";
import { isIsoDate } from "@/logic/rules/dates";
import { shopStock, sortShopProducts, type ShopProduct } from "@/logic/rules/shop";
import {
  effectiveRate,
  instagramHandle,
  orderPrice,
  orderSections,
  orderShortages,
  orderTotal,
  type EurRate,
  type ShopBuyer,
  type ShopOrder,
} from "@/logic/rules/shop-orders";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** MG9: today's € rate – asks NBP (when given), remembers it, and falls back to the last one saved. */
export async function getEurRate(
  orders: ShopOrdersRepository,
  fetchNbp: (() => Promise<{ rate: number; date: IsoDate } | null>) | null,
): Promise<{ rate: EurRate | null; own: number | null; nbp: { rate: number; date: IsoDate } | null }> {
  const settings = await orders.getSettings();
  let nbp = settings.nbpEurRate && settings.nbpRateDate ? { rate: settings.nbpEurRate, date: settings.nbpRateDate } : null;
  const fresh = fetchNbp ? await fetchNbp() : null;
  if (fresh && isIsoDate(fresh.date) && fresh.rate > 0 && (fresh.rate !== nbp?.rate || fresh.date !== nbp?.date)) {
    nbp = fresh;
    try {
      await orders.saveNbpRate(fresh.rate, fresh.date);
    } catch {
      // Remembering the rate is only a fallback for when NBP is down.
    }
  }
  return { rate: effectiveRate(settings.ownEurRate, nbp), own: settings.ownEurRate, nbp };
}

/** MG9: «Свой курс» – a number such as «4,30»; empty = back to NBP. */
export async function setOwnEurRate(orders: ShopOrdersRepository, input: string): Promise<boolean> {
  const text = input.trim().replace(",", ".");
  if (text === "") {
    await orders.setOwnRate(null);
    return true;
  }
  const rate = Number(text);
  if (!Number.isFinite(rate) || rate <= 0 || rate >= 100) return false;
  await orders.setOwnRate(Math.round(rate * 10000) / 10000);
  return true;
}

/** MG9/MG12: one order as shown – buyer, lines with product names, total in zł. */
export type OrderView = ShopOrder & {
  buyer: ShopBuyer;
  lines: { id: string; productId: string; name: string; size: string; brand: string; quantity: number; price: number }[];
  total: { pieces: number; value: number };
};

/** MG12 «Заказы»: waiting (oldest first) and handed over (newest first); only one buyer's when asked. */
export async function getOrders(
  shop: ShopRepository,
  orders: ShopOrdersRepository,
  buyerId: string | null,
): Promise<{ waiting: OrderView[]; handed: OrderView[]; buyer: ShopBuyer | null }> {
  const [products, buyers, list] = await Promise.all([shop.listProducts(), orders.listBuyers(), orders.listOrders()]);
  const productById = new Map(products.map((p) => [p.id, p]));
  const buyerById = new Map(buyers.map((b) => [b.id, b]));
  const views = list
    .filter((o) => !buyerId || o.buyerId === buyerId)
    .map((o): OrderView => ({
      ...o,
      buyer: buyerById.get(o.buyerId) ?? { id: o.buyerId, name: "—", phone: "", instagram: "" },
      lines: o.items.map((i) => {
        const p = productById.get(i.productId);
        return { id: i.id, productId: i.productId, name: p?.name ?? "—", size: p?.size ?? "", brand: p?.brand ?? "", quantity: i.quantity, price: i.price };
      }),
      total: orderTotal(o.items),
    }));
  return { ...orderSections(views), buyer: buyerId ? (buyerById.get(buyerId) ?? null) : null };
}

/** MG9: what the order form needs – products with stock and suggested price, buyers, the order. */
export type OrderFormProduct = Pick<ShopProduct, "id" | "brand" | "name" | "size" | "currency" | "price"> & { stock: number; suggested: number | null };

export async function getOrderForm(
  shop: ShopRepository,
  orders: ShopOrdersRepository,
  id: string | null,
  rate: EurRate | null,
): Promise<{ products: OrderFormProduct[]; buyers: ShopBuyer[]; order: ShopOrder | null; buyer: ShopBuyer | null } | null> {
  const order = id ? (uuid.test(id) ? await orders.getOrder(id) : null) : null;
  if (id && (!order || order.handedOverOn)) return null;
  const [products, movements, buyers] = await Promise.all([shop.listProducts(), shop.listMovements(), orders.listBuyers()]);
  // The order's own sales count as available again while it is being changed.
  const own = new Set(order?.items.map((i) => i.id) ?? []);
  const stock = shopStock(movements.filter((m) => !(m.orderItemId && own.has(m.orderItemId))));
  const inOrder = new Set(order?.items.map((i) => i.productId) ?? []);
  return {
    products: sortShopProducts(products.filter((p) => p.active || inOrder.has(p.id))).map((p) => ({
      id: p.id,
      brand: p.brand,
      name: p.name,
      size: p.size,
      currency: p.currency,
      price: p.price,
      stock: stock.get(p.id) ?? 0,
      suggested: orderPrice(p, rate),
    })),
    buyers,
    order,
    buyer: order ? (buyers.find((b) => b.id === order.buyerId) ?? null) : null,
  };
}

export type OrderFormInput = {
  buyerId?: string | null;
  buyerName?: string;
  buyerPhone?: string;
  buyerInstagram?: string;
  items?: { productId?: string; quantity?: number | string; price?: number | string }[];
};
export type OrderErrors = {
  buyerName?: "required";
  items?: "required";
  lines?: Record<number, "quantity" | "price">;
  stock?: Record<string, number>;
};

/**
 * MG9: «Сохранить» – buyer name and at least one product needed; whole pieces 1–1000, price ≥ 0 zł; never
 * more than is in stock (MG7). Phone and Instagram are optional.
 */
export async function saveOrder(
  shop: ShopRepository,
  orders: ShopOrdersRepository,
  id: string | null,
  input: OrderFormInput,
  today: IsoDate,
  rate: EurRate | null,
): Promise<{ ok: true; id: string } | { ok: false; errors: OrderErrors } | { ok: false; notFound: true }> {
  const existing = id ? (uuid.test(id) ? await orders.getOrder(id) : null) : null;
  if (id && (!existing || existing.handedOverOn)) return { ok: false, notFound: true };

  const errors: OrderErrors = {};
  const buyerName = (input.buyerName ?? "").trim().slice(0, 120);
  if (!buyerName) errors.buyerName = "required";
  const products = new Map((await shop.listProducts()).map((p) => [p.id, p]));
  const items: { productId: string; quantity: number; price: number }[] = [];
  const lineErrors: Record<number, "quantity" | "price"> = {};
  (input.items ?? []).forEach((raw, n) => {
    if (!raw.productId || !products.has(raw.productId)) return;
    const quantity = Number(String(raw.quantity ?? "").trim());
    const price = Number(String(raw.price ?? "").trim().replace(",", ".").replace(/\s/g, ""));
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 1000) lineErrors[n] = "quantity";
    else if (String(raw.price ?? "").trim() === "" || !Number.isFinite(price) || price < 0 || price > 1_000_000) lineErrors[n] = "price";
    else items.push({ productId: raw.productId, quantity, price: Math.round(price * 100) / 100 });
  });
  if (Object.keys(lineErrors).length > 0) errors.lines = lineErrors;
  else if (items.length === 0) errors.items = "required";
  if (items.length > 0 && !errors.lines) {
    const short = orderShortages(await shop.listMovements(), items, new Set(existing?.items.map((i) => i.id) ?? []));
    if (short.size > 0) errors.stock = Object.fromEntries(short);
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const buyerId = input.buyerId && uuid.test(input.buyerId) && (await orders.listBuyers()).some((b) => b.id === input.buyerId) ? input.buyerId : null;
  const result = await orders.saveOrder(existing?.id ?? null, {
    buyerId,
    buyerName,
    buyerPhone: (input.buyerPhone ?? "").trim().slice(0, 40),
    buyerInstagram: instagramHandle(input.buyerInstagram ?? ""),
    orderedOn: existing?.orderedOn ?? today,
    eurRate: rate?.rate ?? null,
    rateSource: rate?.source ?? null,
    items,
  });
  return { ok: true, id: result.id };
}

/** MG12: «Выдан ✓» (the whole order, today) – or back to waiting. */
export async function setOrderHandedOver(orders: ShopOrdersRepository, id: string, handed: boolean, today: IsoDate): Promise<boolean> {
  if (!uuid.test(id)) return false;
  return orders.setHandedOver(id, handed ? today : null);
}

/** MG12: «Отменить заказ» – only while it is waiting; the products go back to stock. */
export async function cancelOrder(orders: ShopOrdersRepository, id: string): Promise<boolean> {
  if (!uuid.test(id)) return false;
  return orders.deleteOrder(id);
}
