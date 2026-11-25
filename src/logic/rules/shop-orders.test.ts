import { describe, expect, it } from "vitest";
import type { ShopMovement } from "./shop";
import { shopSales } from "./shop";
import { monthProfit, orderProfit, eurInZl, preselect, whoWaits, canHandOver, effectiveRate, instagramHandle, matchesBuyer, orderMissing, orderPrice, orderSales, orderSections, orderTotal, paymentState, waitingForStock, type ShopOrder } from "./shop-orders";

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
    expect(orderTotal([{ quantity: 2, price: 230.41 }, { quantity: 1, price: 337 }])).toEqual({ pieces: 3, value: 797.82, before: 797.82 });
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

describe("MG16: отложенный товар", () => {
  const order = (id: string, orderedOn: string, quantity: number, missing: number, paid: number[] = [], handedOverOn: string | null = null) => ({
    id, buyerId: "b", buyerName: `Покупатель ${id}`, orderedOn, eurRate: null, rateSource: null, handedOverOn, createdAt: `${orderedOn}T10:00:00Z`,
    items: [{ id: `${id}-1`, productId: "a", quantity, price: 100, missing }],
    payments: paid.map((amount, n) => ({ id: `${id}-p${n}`, amount, paidOn: orderedOn })),
  });

  it("MG16: «Кто ждёт» – every open order, paid or not, oldest first, put aside and missing", () => {
    const waits = whoWaits([order("o2", "2026-11-15", 1, 1), order("o1", "2026-11-11", 2, 0, [200]), order("o3", "2026-11-01", 1, 0, [], "2026-11-02")]);
    expect(waits.get("a")?.map((w) => [w.orderId, w.paid, w.reserved, w.missing])).toEqual([
      ["o1", "paid", 2, 0],
      ["o2", "unpaid", 0, 1],
    ]);
  });

  it("MG16: «Кому отложить?» – the oldest waiting are ticked first, as many as came in", () => {
    const waits = whoWaits([order("o1", "2026-11-11", 2, 2), order("o2", "2026-11-12", 1, 1), order("o3", "2026-11-13", 1, 0)]).get("a")!;
    expect(preselect(waits, 1)).toEqual({ "o1-1": 1 });
    expect(preselect(waits, 3)).toEqual({ "o1-1": 2, "o2-1": 1 });
    expect(preselect(waits, 9)).toEqual({ "o1-1": 2, "o2-1": 1 });
  });
});

describe("MG17: Instytutum – цена в злотых", () => {
  it("MG17: € to whole zł by the rate, the same as an order would price it; nothing without a rate", () => {
    expect(eurInZl(78.75, 4.2836)).toBe(337);
    expect(eurInZl(78.75, 4.2836)).toBe(orderPrice({ price: 78.75, currency: "EUR" }, { rate: 4.2836, source: "nbp", date: "2026-11-18" }));
    expect(eurInZl(79, null)).toBeNull();
    expect(eurInZl(79, 0)).toBeNull();
  });
});

describe("MG20–MG22: скидка и прибыль", () => {
  const item = (productId: string, quantity: number, price: number, purchasePrice: number | null, purchaseCurrency: "PLN" | "EUR" | null = "PLN") => ({
    id: `i-${productId}`,
    productId,
    quantity,
    price,
    missing: 0,
    purchasePrice,
    purchaseCurrency: purchasePrice === null ? null : purchaseCurrency,
  });
  const order = (extra: Partial<ShopOrder>): ShopOrder => ({
    id: "o1",
    buyerId: "b1",
    orderedOn: "2026-11-20",
    eurRate: 4.3,
    rateSource: "nbp",
    handedOverOn: null,
    createdAt: "2026-11-20T10:00:00Z",
    items: [],
    payments: [],
    ...extra,
  });

  it("MG21: a discount on the whole order – rounded to whole zł; none, or anything but 1–99 %, keeps the total", () => {
    const items = [{ quantity: 1, price: 530 }, { quantity: 2, price: 149.99 }];
    expect(orderTotal(items)).toEqual({ pieces: 3, value: 829.98, before: 829.98 });
    expect(orderTotal(items, 20)).toEqual({ pieces: 3, value: 664, before: 829.98 });
    expect(orderTotal(items, 40).value).toBe(498);
    expect(orderTotal(items, 0).value).toBe(829.98);
    expect(orderTotal(items, 100).value).toBe(829.98);
  });

  it("MG22: put aside the purchase price, the rest is Loya's – € by the order's rate; the discount lowers the profit only", () => {
    const o = order({ items: [item("a", 2, 200, 120), item("b", 1, 300, 40, "EUR")] });
    // 2 × 120 + 40 € × 4,3 = 412; 700 − 412 = 288.
    expect(orderProfit(o)).toEqual({ cost: 412, profit: 288, uncounted: 0 });
    // −20 %: 560 zł, the same to put aside.
    expect(orderProfit({ ...o, discountPercent: 20 })).toEqual({ cost: 412, profit: 148, uncounted: 0 });
  });

  it("MG22: lines without a purchase price kept – «не посчитано», left out of both sums", () => {
    const o = order({ items: [item("a", 2, 200, 120), item("b", 3, 300, null)] });
    expect(orderProfit(o)).toEqual({ cost: 240, profit: 160, uncounted: 3 });
    // An € purchase price without the order's rate cannot be counted either.
    expect(orderProfit(order({ eurRate: null, items: [item("b", 1, 300, 40, "EUR")] }))).toEqual({ cost: 0, profit: 0, uncounted: 1 });
  });

  it("MG20: «Итог» of the month – «Склад» sales (not returned, € by today's rate) and the month's orders", () => {
    const sale = (id: string, extra: Partial<ShopMovement>): ShopMovement => ({
      id,
      productId: "a",
      happenedOn: "2026-11-05",
      kind: "sale",
      quantity: 1,
      price: 200,
      currency: "PLN",
      createdAt: "2026-11-05T10:00:00Z",
      purchasePrice: 120,
      purchaseCurrency: "PLN",
      ...extra,
    });
    const movements = [
      sale("s1", {}),
      sale("s2", { price: 79, currency: "EUR", purchasePrice: 30, purchaseCurrency: "EUR" }),
      sale("s3", { purchasePrice: null, purchaseCurrency: null }),
      sale("s4", { returnedOn: "2026-11-06" }),
      sale("s5", { happenedOn: "2026-10-31" }),
      sale("s6", { orderItemId: "i-a" }),
      sale("s7", { kind: "receipt" }),
    ];
    const orders = [order({ discountPercent: 20, items: [item("a", 2, 200, 120)] }), order({ id: "o2", orderedOn: "2026-10-20", items: [item("a", 1, 200, 120)] })];
    // s1: 120 / 80; s2: 30 € = 120 / 49 € = 196; order: 240 / 320 − 240 = 80; s3 not counted.
    expect(monthProfit(movements, orders, "2026-11", 4)).toEqual({ cost: 480, profit: 356, uncounted: 1 });
    // Without a rate the € sale is not counted.
    expect(monthProfit(movements, orders, "2026-11", null)).toEqual({ cost: 360, profit: 160, uncounted: 2 });
  });

  it("MG21: «Продажи» – a discounted order counts what was asked, every product by the same share", () => {
    const o = order({ discountPercent: 20, items: [item("a", 1, 500, null), item("b", 1, 300, null)] });
    const { rows, value } = orderSales([o], "2026-11");
    expect(value).toBe(640);
    expect(rows.map((r) => r.value)).toEqual([400, 240]);
  });
});
