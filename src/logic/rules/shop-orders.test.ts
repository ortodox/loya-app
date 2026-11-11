import { describe, expect, it } from "vitest";
import type { ShopMovement } from "./shop";
import { shopSales } from "./shop";
import { canHandOver, effectiveRate, instagramHandle, matchesBuyer, orderMissing, orderPrice, orderSales, orderSections, orderTotal, paymentState, waitingForStock, type ShopOrder } from "./shop-orders";

const move = (id: string, productId: string, kind: ShopMovement["kind"], quantity: number, orderItemId: string | null = null, extra: Partial<ShopMovement> = {}): ShopMovement => ({
  id,
  productId,
  happenedOn: "2026-11-11",
  kind,
  quantity,
  price: kind === "sale" ? 100 : null,
  currency: kind === "sale" ? "PLN" : null,
  createdAt: `2026-11-11T10:00:0${id.length}Z`,
  orderItemId,
  ...extra,
});

describe("MG9: заказы в злотых", () => {
  it("MG9: the € rate – Loya's own first, else NBP, else none", () => {
    expect(effectiveRate(4.3, { rate: 4.31, date: "2026-11-11" })).toEqual({ rate: 4.3, source: "own", date: null });
    expect(effectiveRate(null, { rate: 4.31, date: "2026-11-11" })).toEqual({ rate: 4.31, source: "nbp", date: "2026-11-11" });
    expect(effectiveRate(null, null)).toBeNull();
  });

  it("MG9: zł prices stay, € prices by the rate rounded to whole zł", () => {
    const rate = { rate: 4.2836, source: "nbp" as const, date: "2026-11-11" };
    expect(orderPrice({ price: 530, currency: "PLN" }, rate)).toBe(530);
    expect(orderPrice({ price: 78.75, currency: "EUR" }, rate)).toBe(337); // 337,33 → 337
    expect(orderPrice({ price: 78.75, currency: "EUR" }, null)).toBeNull();
  });

  it("MG9: total of an order in zł", () => {
    expect(orderTotal([{ quantity: 2, price: 230.41 }, { quantity: 1, price: 337 }])).toEqual({ pieces: 3, value: 797.82 });
  });

  it("MG10: what is not in stock is «Нужно заказать»; the order's own sales count as available when it is changed", () => {
    const movements = [move("r", "a", "receipt", 3), move("s", "a", "sale", 2, "item-1")];
    expect(orderMissing(movements, [{ productId: "a", quantity: 2 }], new Set())).toEqual([1]);
    expect(orderMissing(movements, [{ productId: "a", quantity: 2 }], new Set(["item-1"]))).toEqual([0]);
    expect(orderMissing(movements, [{ productId: "a", quantity: 2 }, { productId: "a", quantity: 2 }, { productId: "b", quantity: 1 }], new Set(["item-1"]))).toEqual([0, 1, 1]);
  });

  it("MG9: Instagram handle from «@name» or a link; buyers found by name, @ or phone digits", () => {
    expect(instagramHandle(" @anna.beauty ")).toBe("anna.beauty");
    expect(instagramHandle("https://www.instagram.com/anna_b/?hl=pl")).toBe("anna_b");
    expect(instagramHandle("Анна")).toBe("");
    const buyer = { id: "b", name: "Анна Тестова", phone: "+48 600 111 222", instagram: "anna.beauty" };
    expect(matchesBuyer(buyer, "анна")).toBe(true);
    expect(matchesBuyer(buyer, "@anna")).toBe(true);
    expect(matchesBuyer(buyer, "111 2")).toBe(true);
    expect(matchesBuyer(buyer, "Ольга")).toBe(false);
  });

  it("MG9/MG11: «Продажи» counts the whole order on its day (also what is still missing) and what is not paid", () => {
    const order = (id: string, orderedOn: string, payments: number[]): ShopOrder => ({
      id, buyerId: "b", orderedOn, eurRate: null, rateSource: null, handedOverOn: null, createdAt: `${orderedOn}T10:00:00Z`,
      items: [{ id: `${id}-1`, productId: "a", quantity: 2, price: 100, missing: 1 }, { id: `${id}-2`, productId: "b", quantity: 1, price: 340, missing: 0 }],
      payments: payments.map((amount, n) => ({ id: `${id}-p${n}`, amount, paidOn: orderedOn })),
    });
    const sales = orderSales([order("o1", "2026-11-10", [300]), order("o2", "2026-10-30", [])], "2026-11");
    expect(sales).toEqual({ rows: [{ productId: "a", orderId: "o1", quantity: 2, value: 200 }, { productId: "b", orderId: "o1", quantity: 1, value: 340 }], pieces: 3, value: 540, unpaid: 240 });
  });

  it("MG9: a tap in «Склад» in € stays in €; order sales are left to orderSales", () => {
    const product = { id: "i", brand: "Instytutum", category: "", name: "Cream", size: "", currency: "EUR" as const, price: 79, favorite: false, active: true, sortOrder: 0 };
    const sales = shopSales([move("a", "i", "sale", 1, null, { price: 79, currency: "EUR" }), move("b", "i", "sale", 1, "x", { price: 340, currency: "PLN" })], [product], "2026-11");
    expect(sales.value).toEqual({ PLN: 0, EUR: 79 });
  });
});

describe("MG11/MG12: оплата и выдача", () => {
  it("MG11: not paid, partly, paid (more than the total counts as paid)", () => {
    expect(paymentState(1330, [])).toEqual({ paid: 0, left: 1330, status: "unpaid" });
    expect(paymentState(1330, [{ amount: 500 }, { amount: 330.5 }])).toEqual({ paid: 830.5, left: 499.5, status: "partial" });
    expect(paymentState(1330, [{ amount: 1400 }])).toEqual({ paid: 1400, left: 0, status: "paid" });
  });

  it("MG12/MG11: waiting oldest first; handed over but not paid; done newest first", () => {
    const paid = paymentState(10, [{ amount: 10 }]);
    const not = paymentState(10, []);
    const o = (id: string, orderedOn: string, handedOverOn: string | null, payment = not) => ({ id, orderedOn, createdAt: `${orderedOn}T10:00:00Z`, handedOverOn, payment });
    const { waiting, unpaid, done } = orderSections([o("a", "2026-11-10", null), o("b", "2026-11-09", null, paid), o("c", "2026-11-01", "2026-11-02", paid), o("d", "2026-11-05", "2026-11-06", paid), o("e", "2026-11-03", "2026-11-04")]);
    expect(waiting.map((x) => x.id)).toEqual(["b", "a"]);
    expect(unpaid.map((x) => x.id)).toEqual(["e"]);
    expect(done.map((x) => x.id)).toEqual(["d", "c"]);
  });

  it("MG10/MG12: hand over only when nothing is missing; what waits for stock, oldest order first", () => {
    const order = (id: string, orderedOn: string, missing: number, handedOverOn: string | null = null) => ({
      id, buyerId: "b", buyerName: `Покупатель ${id}`, orderedOn, eurRate: null, rateSource: null, handedOverOn, createdAt: `${orderedOn}T10:00:00Z`,
      items: [{ id: `${id}-1`, productId: "a", quantity: 2, price: 100, missing }], payments: [],
    });
    expect(canHandOver(order("x", "2026-11-01", 1))).toBe(false);
    expect(canHandOver(order("x", "2026-11-01", 0))).toBe(true);
    const waiting = waitingForStock([order("o2", "2026-11-10", 1), order("o1", "2026-11-02", 2), order("o3", "2026-11-01", 0), order("o4", "2026-11-01", 1, "2026-11-03")]);
    expect(waiting.get("a")?.map((w) => [w.orderId, w.missing])).toEqual([["o1", 2], ["o2", 1]]);
  });
});
