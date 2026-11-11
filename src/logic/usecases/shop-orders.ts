import type { IsoDate } from "@/logic/client";
import type { ShopRepository } from "@/data/repositories/shop";
import type { ShopOrdersRepository } from "@/data/repositories/shop-orders";
import { isIsoDate } from "@/logic/rules/dates";
import { shopStock, sortShopProducts, type ShopProduct } from "@/logic/rules/shop";
import {
  canHandOver,
  effectiveRate,
  instagramHandle,
  orderMissing,
  orderPrice,
  orderSections,
  orderTotal,
  paymentState,
  waitingForStock,
  type EurRate,
  type PaymentState,
  type ShopBuyer,
  type ShopOrder,
  type WaitingLine,
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

/** MG9–MG12: one order as shown – buyer, lines with product names and what is missing, total and payment in zł. */
export type OrderView = ShopOrder & {
  buyer: ShopBuyer;
  lines: { id: string; productId: string; name: string; size: string; brand: string; quantity: number; price: number; missing: number }[];
  total: { pieces: number; value: number };
  payment: PaymentState;
  canHandOver: boolean;
};

/** MG12/MG11 «Заказы»: waiting, handed over but not paid, done; only one buyer's when asked. */
export async function getOrders(
  shop: ShopRepository,
  orders: ShopOrdersRepository,
  buyerId: string | null,
): Promise<{ waiting: OrderView[]; unpaid: OrderView[]; done: OrderView[]; buyer: ShopBuyer | null }> {
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
        return { id: i.id, productId: i.productId, name: p?.name ?? "—", size: p?.size ?? "", brand: p?.brand ?? "", quantity: i.quantity, price: i.price, missing: i.missing };
      }),
      total: orderTotal(o.items),
      payment: paymentState(orderTotal(o.items).value, o.payments),
      canHandOver: canHandOver(o),
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
};

/**
 * MG9/MG10: «Сохранить» – buyer name and at least one product needed; whole pieces 1–1000, price ≥ 0 zł.
 * What is not in stock is kept as «Нужно заказать» (MG10) – the stock never goes below zero (MG7).
 * Phone and Instagram are optional.
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
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  const missing = orderMissing(await shop.listMovements(), items, new Set(existing?.items.map((i) => i.id) ?? []));

  const buyerId = input.buyerId && uuid.test(input.buyerId) && (await orders.listBuyers()).some((b) => b.id === input.buyerId) ? input.buyerId : null;
  const result = await orders.saveOrder(existing?.id ?? null, {
    buyerId,
    buyerName,
    buyerPhone: (input.buyerPhone ?? "").trim().slice(0, 40),
    buyerInstagram: instagramHandle(input.buyerInstagram ?? ""),
    orderedOn: today, // a new order's day; when changed, its sales are taken out today
    eurRate: rate?.rate ?? null,
    rateSource: rate?.source ?? null,
    items: items.map((i, n) => ({ ...i, missing: missing[n] })),
  });
  return { ok: true, id: result.id };
}

/** MG12: «Выдан ✓» (the whole order, today) – only when nothing is missing (MG10) – or back to waiting. */
export async function setOrderHandedOver(orders: ShopOrdersRepository, id: string, handed: boolean, today: IsoDate): Promise<boolean> {
  if (!uuid.test(id)) return false;
  if (handed) {
    const order = await orders.getOrder(id);
    if (!order || !canHandOver(order)) return false;
  }
  return orders.setHandedOver(id, handed ? today : null);
}

/** MG10 «Нужно заказать» in «Склад»: per product, the orders waiting for it (oldest first). */
export async function getWaitingForStock(orders: ShopOrdersRepository): Promise<Record<string, WaitingLine[]>> {
  const [list, buyers] = await Promise.all([orders.listOrders(), orders.listBuyers()]);
  const names = new Map(buyers.map((b) => [b.id, b.name]));
  return Object.fromEntries(waitingForStock(list.map((o) => ({ ...o, buyerName: names.get(o.buyerId) ?? "—" }))));
}

/** MG10: «+» → «Для какого заказа?» → this order: the piece comes in and goes straight to the order. */
export async function giveReceiptToOrder(orders: ShopOrdersRepository, orderItemId: string, today: IsoDate): Promise<boolean> {
  if (!uuid.test(orderItemId)) return false;
  return orders.giveReceiptToOrder(orderItemId, today);
}

/** MG11 «Оплата»: an amount in zł («500», «500,50»), more than 0. */
export async function addPayment(orders: ShopOrdersRepository, orderId: string, input: string, today: IsoDate): Promise<boolean> {
  if (!uuid.test(orderId)) return false;
  const amount = Number(input.trim().replace(",", ".").replace(/\s/g, ""));
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) return false;
  if (!(await orders.getOrder(orderId))) return false;
  await orders.addPayment(orderId, Math.round(amount * 100) / 100, today);
  return true;
}

/** MG11: take back a payment entered by mistake. */
export async function deletePayment(orders: ShopOrdersRepository, paymentId: string): Promise<boolean> {
  if (!uuid.test(paymentId)) return false;
  return orders.deletePayment(paymentId);
}

/** MG12: «Отменить заказ» – only while it is waiting; the products go back to stock. */
export async function cancelOrder(orders: ShopOrdersRepository, id: string): Promise<boolean> {
  if (!uuid.test(id)) return false;
  return orders.deleteOrder(id);
}
