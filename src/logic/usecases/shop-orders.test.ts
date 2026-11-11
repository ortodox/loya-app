import { describe, expect, it } from "vitest";
import type { ShopRepository } from "@/data/repositories/shop";
import type { ShopOrderInput, ShopOrdersRepository, ShopSettings } from "@/data/repositories/shop-orders";
import type { ShopMovement, ShopProduct } from "@/logic/rules/shop";
import { shopStock } from "@/logic/rules/shop";
import { getShopSales } from "./shop";
import type { ShopBuyer, ShopOrder } from "@/logic/rules/shop-orders";
import { addPayment, cancelOrder, deletePayment, getEurRate, getOrders, getWaitingForStock, giveReceiptToOrder, saveOrder, setOrderHandedOver, setOwnEurRate } from "./shop-orders";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const today = "2026-11-11";

function setup() {
  let n = 100;
  const products: ShopProduct[] = [
    { id: id(1), brand: "Medik8", category: "Витамин A", name: "Crystal Retinal 10", size: "30 ml", currency: "PLN", price: 530, favorite: false, active: true, sortOrder: 10 },
    { id: id(2), brand: "Instytutum", category: "Кремы", name: "Retinol Cream", size: "50 ml", currency: "EUR", price: 79, favorite: false, active: true, sortOrder: 20 },
  ];
  const movements: ShopMovement[] = [
    { id: "r1", productId: id(1), happenedOn: "2026-11-01", kind: "receipt", quantity: 3, price: null, currency: null, createdAt: "2026-11-01T10:00:00Z" },
    { id: "r2", productId: id(2), happenedOn: "2026-11-01", kind: "receipt", quantity: 1, price: null, currency: null, createdAt: "2026-11-01T10:00:00Z" },
  ];
  const buyers: ShopBuyer[] = [];
  const orders: ShopOrder[] = [];
  const settings: ShopSettings = { ownEurRate: null, nbpEurRate: 4.2, nbpRateDate: "2026-11-10" };
  const shop = { listProducts: async () => products, listMovements: async () => movements.map((m) => ({ ...m })) } as unknown as ShopRepository;
  const repo: ShopOrdersRepository = {
    listBuyers: async () => buyers.map((b) => ({ ...b })),
    listOrders: async () => orders.map((o) => ({ ...o, items: [...o.items] })),
    getOrder: async (oid) => orders.find((o) => o.id === oid) ?? null,
    async saveOrder(oid, input: ShopOrderInput) {
      let buyerId = input.buyerId;
      if (!buyerId) {
        buyerId = id(n++);
        buyers.push({ id: buyerId, name: input.buyerName, phone: input.buyerPhone, instagram: input.buyerInstagram });
      } else Object.assign(buyers.find((b) => b.id === buyerId)!, { name: input.buyerName, phone: input.buyerPhone, instagram: input.buyerInstagram });
      let order = orders.find((o) => o.id === oid);
      if (order) {
        const old = new Set(order.items.map((i) => i.id));
        for (let i = movements.length - 1; i >= 0; i--) if (movements[i].orderItemId && old.has(movements[i].orderItemId!)) movements.splice(i, 1);
        Object.assign(order, { buyerId, eurRate: input.eurRate, rateSource: input.rateSource });
      } else {
        order = { id: id(n++), buyerId, orderedOn: input.orderedOn, eurRate: input.eurRate, rateSource: input.rateSource, handedOverOn: null, createdAt: `${input.orderedOn}T12:00:00Z`, items: [], payments: [] };
        orders.push(order);
      }
      const saved = order;
      saved.items = input.items.map((i) => ({ id: id(n++), ...i }));
      for (const i of saved.items)
        if (i.quantity - i.missing > 0)
          movements.push({ id: `m${n++}`, productId: i.productId, happenedOn: input.orderedOn, kind: "sale", quantity: i.quantity - i.missing, price: i.price, currency: "PLN", createdAt: `${input.orderedOn}T12:00:${String(n).padStart(2, "0")}Z`, orderItemId: i.id });
      return { id: saved.id };
    },
    async setHandedOver(oid, on) {
      const o = orders.find((x) => x.id === oid);
      if (o) o.handedOverOn = on;
      return Boolean(o);
    },
    async deleteOrder(oid) {
      const o = orders.find((x) => x.id === oid && !x.handedOverOn);
      if (!o) return false;
      const items = new Set(o.items.map((i) => i.id));
      for (let i = movements.length - 1; i >= 0; i--) if (movements[i].orderItemId && items.has(movements[i].orderItemId!)) movements.splice(i, 1);
      orders.splice(orders.indexOf(o), 1);
      return true;
    },
    async giveReceiptToOrder(itemId, on) {
      const found = orders.find((o) => !o.handedOverOn && o.items.some((i) => i.id === itemId && i.missing > 0));
      if (!found) return false;
      const item = found.items.find((i) => i.id === itemId)!;
      item.missing -= 1;
      movements.push({ id: `m${n++}`, productId: item.productId, happenedOn: on, kind: "receipt", quantity: 1, price: null, currency: null, createdAt: `${on}T13:00:${String(n).padStart(2, "0")}Z` });
      movements.push({ id: `m${n++}`, productId: item.productId, happenedOn: on, kind: "sale", quantity: 1, price: item.price, currency: "PLN", createdAt: `${on}T13:00:${String(n).padStart(2, "0")}Z`, orderItemId: itemId });
      return true;
    },
    async addPayment(orderId, amount, on) {
      orders.find((o) => o.id === orderId)!.payments.push({ id: id(n++), amount, paidOn: on });
    },
    async deletePayment(pid) {
      for (const o of orders) {
        const k = o.payments.findIndex((p) => p.id === pid);
        if (k >= 0) {
          o.payments.splice(k, 1);
          return true;
        }
      }
      return false;
    },
    getSettings: async () => ({ ...settings }),
    async saveNbpRate(rate, date) {
      Object.assign(settings, { nbpEurRate: rate, nbpRateDate: date });
    },
    async setOwnRate(rate) {
      settings.ownEurRate = rate;
    },
  };
  return { shop, repo, movements, orders, buyers, settings };
}

describe("MG9: заказ", () => {
  it("MG9: NBP rate is remembered; NBP down → the last one; own rate wins; empty → NBP again", async () => {
    const { repo, settings } = setup();
    expect((await getEurRate(repo, async () => ({ rate: 4.31, date: "2026-11-11" }))).rate).toEqual({ rate: 4.31, source: "nbp", date: "2026-11-11" });
    expect(settings.nbpEurRate).toBe(4.31);
    expect((await getEurRate(repo, async () => null)).rate?.rate).toBe(4.31);
    expect(await setOwnEurRate(repo, "4,30")).toBe(true);
    expect((await getEurRate(repo, null)).rate).toEqual({ rate: 4.3, source: "own", date: null });
    expect(await setOwnEurRate(repo, "abc")).toBe(false);
    expect(await setOwnEurRate(repo, "")).toBe(true);
    expect((await getEurRate(repo, null)).rate?.source).toBe("nbp");
  });

  it("MG9: one buyer, several products in zł – stock goes down, sales in zł, all shown together", async () => {
    const { shop, repo, movements, buyers } = setup();
    const rate = { rate: 4.31, source: "nbp" as const, date: today };
    const result = await saveOrder(shop, repo, null, { buyerName: " Анна ", buyerInstagram: "@anna.beauty", items: [{ productId: id(1), quantity: "2", price: "500" }, { productId: id(2), quantity: 1, price: "340,00" }] }, today, rate);
    expect(result).toMatchObject({ ok: true });
    expect(buyers).toEqual([{ id: expect.any(String), name: "Анна", phone: "", instagram: "anna.beauty" }]);
    expect(shopStock(movements).get(id(1))).toBe(1);
    const { waiting } = await getOrders(shop, repo, null);
    expect(waiting[0]).toMatchObject({ eurRate: 4.31, rateSource: "nbp", total: { pieces: 3, value: 1340 } });
    expect(waiting[0].lines.map((l) => [l.name, l.quantity, l.price])).toEqual([["Crystal Retinal 10", 2, 500], ["Retinol Cream", 1, 340]]);
  });

  it("MG9: buyer name and a product are needed; bad lines and too many pieces are refused", async () => {
    const { shop, repo, orders } = setup();
    expect(await saveOrder(shop, repo, null, { buyerName: "", items: [] }, today, null)).toEqual({ ok: false, errors: { buyerName: "required", items: "required" } });
    expect(await saveOrder(shop, repo, null, { buyerName: "Анна", items: [{ productId: id(1), quantity: "0", price: "1" }, { productId: id(1), quantity: "1", price: "-1" }] }, today, null)).toEqual({
      ok: false,
      errors: { lines: { 0: "quantity", 1: "price" } },
    });
    expect(orders).toHaveLength(0);
  });

  it("MG9: changing an order replaces its lines; the earlier buyer is kept", async () => {
    const { shop, repo, movements, buyers } = setup();
    const first = await saveOrder(shop, repo, null, { buyerName: "Анна", items: [{ productId: id(1), quantity: "3", price: "530" }] }, today, null);
    const oid = (first as { id: string }).id;
    const again = await saveOrder(shop, repo, oid, { buyerId: buyers[0].id, buyerName: "Анна К.", items: [{ productId: id(1), quantity: "1", price: "500" }] }, "2026-11-20", null);
    expect(again).toEqual({ ok: true, id: oid });
    expect(buyers).toHaveLength(1);
    expect(buyers[0].name).toBe("Анна К.");
    expect(shopStock(movements).get(id(1))).toBe(2);
    expect(movements.filter((m) => m.orderItemId).map((m) => m.happenedOn)).toEqual(["2026-11-20"]);
  });
});

describe("MG12: выдача и отмена", () => {
  it("MG12: «Выдан ✓» moves the order down; it cannot then be changed or cancelled", async () => {
    const { shop, repo } = setup();
    const { id: oid } = (await saveOrder(shop, repo, null, { buyerName: "Анна", items: [{ productId: id(1), quantity: "1", price: "530" }] }, today, null)) as { id: string };
    expect(await setOrderHandedOver(repo, oid, true, today)).toBe(true);
    const { waiting, unpaid } = await getOrders(shop, repo, null);
    expect([waiting.length, unpaid[0].handedOverOn]).toEqual([0, today]);
    expect(await saveOrder(shop, repo, oid, { buyerName: "Анна", items: [{ productId: id(1), quantity: "1", price: "1" }] }, today, null)).toEqual({ ok: false, notFound: true });
    expect(await cancelOrder(repo, oid)).toBe(false);
  });

  it("MG12: «Отменить заказ» puts the products back in stock", async () => {
    const { shop, repo, movements } = setup();
    const { id: oid } = (await saveOrder(shop, repo, null, { buyerName: "Анна", items: [{ productId: id(1), quantity: "3", price: "530" }] }, today, null)) as { id: string };
    expect(shopStock(movements).get(id(1))).toBe(0);
    expect(await cancelOrder(repo, oid)).toBe(true);
    expect(shopStock(movements).get(id(1))).toBe(3);
  });
});

describe("MG10/MG11: нужно заказать и оплата", () => {
  it("MG10: more than in stock is saved – the rest is «Нужно заказать», stock stays at 0, no hand-over yet", async () => {
    const { shop, repo, movements } = setup();
    const { id: oid } = (await saveOrder(shop, repo, null, { buyerName: "Анна", items: [{ productId: id(2), quantity: "3", price: "340" }] }, today, null)) as { id: string };
    const { waiting } = await getOrders(shop, repo, null);
    expect(waiting[0].lines[0].missing).toBe(2);
    expect(waiting[0].canHandOver).toBe(false);
    expect(shopStock(movements).get(id(2))).toBe(0);
    expect(await setOrderHandedOver(repo, oid, true, today)).toBe(false);
    const wait = await getWaitingForStock(repo);
    expect(wait[id(2)].map((w) => [w.buyerName, w.missing])).toEqual([["Анна", 2]]);
  });

  it("MG10: «+» → «Для какого заказа?» → the piece goes to the order; once all is there it can be handed over", async () => {
    const { shop, repo, movements } = setup();
    const { id: oid } = (await saveOrder(shop, repo, null, { buyerName: "Анна", items: [{ productId: id(2), quantity: "2", price: "340" }] }, today, null)) as { id: string };
    const itemId = (await repo.getOrder(oid))!.items[0].id;
    expect(await giveReceiptToOrder(repo, itemId, "2026-11-12")).toBe(true);
    expect(shopStock(movements).get(id(2))).toBe(0);
    expect(await giveReceiptToOrder(repo, itemId, "2026-11-12")).toBe(false);
    expect(await setOrderHandedOver(repo, oid, true, "2026-11-12")).toBe(true);
  });

  it("MG11: payments in zł – partly, then paid; a wrong one can be taken back; «Продажи» shows what is not paid", async () => {
    const { shop, repo } = setup();
    const { id: oid } = (await saveOrder(shop, repo, null, { buyerName: "Анна", items: [{ productId: id(1), quantity: "2", price: "500" }] }, today, null)) as { id: string };
    expect(await addPayment(repo, oid, "300", today)).toBe(true);
    expect(await addPayment(repo, oid, "0", today)).toBe(false);
    expect(await addPayment(repo, oid, "abc", today)).toBe(false);
    expect((await getOrders(shop, repo, null)).waiting[0].payment).toEqual({ paid: 300, left: 700, status: "partial" });
    expect((await getShopSales(shop, "2026-11", today, repo)).sales).toMatchObject({ pieces: 2, value: { PLN: 1000, EUR: 0 }, unpaid: 700 });
    expect(await addPayment(repo, oid, "700,00", today)).toBe(true);
    const order = (await getOrders(shop, repo, null)).waiting[0];
    expect(order.payment.status).toBe("paid");
    expect(await deletePayment(repo, order.payments[1].id)).toBe(true);
    expect((await getOrders(shop, repo, null)).waiting[0].payment.status).toBe("partial");
  });
});
