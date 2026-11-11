import { describe, expect, it } from "vitest";
import type { ShopMovement } from "./shop";
import { shopSales } from "./shop";
import { effectiveRate, instagramHandle, matchesBuyer, orderPrice, orderSections, orderShortages, orderTotal } from "./shop-orders";

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

  it("MG9/MG7: never more than in stock; the order's own sales count as available when it is changed", () => {
    const movements = [move("r", "a", "receipt", 3), move("s", "a", "sale", 2, "item-1")];
    expect(orderShortages(movements, [{ productId: "a", quantity: 2 }], new Set())).toEqual(new Map([["a", 1]]));
    expect(orderShortages(movements, [{ productId: "a", quantity: 2 }], new Set(["item-1"])).size).toBe(0);
    expect(orderShortages(movements, [{ productId: "a", quantity: 2 }, { productId: "a", quantity: 2 }], new Set(["item-1"]))).toEqual(new Map([["a", 3]]));
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

  it("MG9: an Instytutum order in zł and a tap in € are separate rows in «Продажи»", () => {
    const product = { id: "i", brand: "Instytutum", category: "", name: "Cream", size: "", currency: "EUR" as const, price: 79, favorite: false, active: true, sortOrder: 0 };
    const sales = shopSales([move("a", "i", "sale", 1, null, { price: 79, currency: "EUR" }), move("b", "i", "sale", 1, "x", { price: 340, currency: "PLN" })], [product], "2026-11");
    expect(sales.value).toEqual({ PLN: 340, EUR: 79 });
    expect(sales.rows).toHaveLength(2);
  });
});

describe("MG12: выдача", () => {
  it("MG12: waiting oldest first, handed over newest first", () => {
    const o = (id: string, orderedOn: string, handedOverOn: string | null) => ({ id, orderedOn, createdAt: `${orderedOn}T10:00:00Z`, handedOverOn });
    const { waiting, handed } = orderSections([o("a", "2026-11-10", null), o("b", "2026-11-09", null), o("c", "2026-11-01", "2026-11-02"), o("d", "2026-11-05", "2026-11-06")]);
    expect(waiting.map((x) => x.id)).toEqual(["b", "a"]);
    expect(handed.map((x) => x.id)).toEqual(["d", "c"]);
  });
});
