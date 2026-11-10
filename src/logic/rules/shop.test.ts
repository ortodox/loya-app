import { describe, expect, it } from "vitest";
import { matchesShopFilter, shopHistory, shopSales, shopStock, sortShopProducts, type ShopMovement, type ShopProduct } from "./shop";

const product = (id: string, extra: Partial<ShopProduct> = {}): ShopProduct => ({
  id,
  brand: "Medik8",
  category: "Витамин C",
  name: `Product ${id}`,
  size: "30 ml",
  currency: "PLN",
  price: 100,
  favorite: false,
  active: true,
  sortOrder: 0,
  ...extra,
});
let n = 0;
const move = (productId: string, happenedOn: string, kind: ShopMovement["kind"], extra: Partial<ShopMovement> = {}): ShopMovement => ({
  id: `m${++n}`,
  productId,
  happenedOn,
  kind,
  quantity: 1,
  price: kind === "sale" ? 100 : null,
  currency: kind === "sale" ? "PLN" : null,
  createdAt: `${happenedOn}T10:00:0${n % 10}Z`,
  ...extra,
});

describe("MG2: склад магазина", () => {
  it("MG2: deliveries in, sales out – stock can go below zero", () => {
    const stock = shopStock([move("a", "2026-11-01", "receipt", { quantity: 3 }), move("a", "2026-11-02", "sale"), move("b", "2026-11-02", "sale")]);
    expect(stock.get("a")).toBe(2);
    expect(stock.get("b")).toBe(-1);
  });

  it("MG2: history – taps of the same kind on the same day are one line, newest first", () => {
    const lines = shopHistory(
      [move("a", "2026-11-01", "receipt", { quantity: 3 }), move("a", "2026-11-02", "sale"), move("a", "2026-11-02", "sale"), move("a", "2026-11-02", "receipt"), move("b", "2026-11-02", "sale")],
      "a",
    );
    expect(lines).toEqual([
      { date: "2026-11-02", kind: "receipt", quantity: 1, balance: 2 },
      { date: "2026-11-02", kind: "sale", quantity: 2, balance: 1 },
      { date: "2026-11-01", kind: "receipt", quantity: 3, balance: 3 },
    ]);
  });
});

describe("MG3: продажи за месяц", () => {
  it("MG3: pieces and value per currency for the month, at the price sold for", () => {
    const products = [product("a"), product("b", { brand: "Instytutum", currency: "EUR", price: 45 })];
    const s = shopSales(
      [
        move("a", "2026-11-02", "sale", { price: 230.41 }),
        move("a", "2026-11-05", "sale", { price: 230.41 }),
        move("b", "2026-11-05", "sale", { price: 45, currency: "EUR" }),
        move("a", "2026-10-30", "sale"),
        move("a", "2026-11-06", "receipt", { quantity: 5 }),
      ],
      products,
      "2026-11",
    );
    expect(s.pieces).toBe(3);
    expect(s.value).toEqual({ PLN: 460.82, EUR: 45 });
    expect(s.rows.map((r) => [r.productId, r.quantity])).toEqual([["a", 2], ["b", 1]]);
  });
});

describe("MG1/MG4: каталог – избранное и поиск", () => {
  it("MG4: ⭐ first, then brand and the price-list order", () => {
    const sorted = sortShopProducts([product("a", { sortOrder: 2 }), product("b", { brand: "Instytutum", sortOrder: 9 }), product("c", { favorite: true, sortOrder: 5 }), product("d", { sortOrder: 1 })]);
    expect(sorted.map((p) => p.id)).toEqual(["c", "b", "d", "a"]);
  });

  it("MG1: search in name, size, category and brand; brand filter", () => {
    const p = product("a", { name: "C-Tetra", category: "Витамин C" });
    expect(matchesShopFilter(p, "tetra", null)).toBe(true);
    expect(matchesShopFilter(p, "витамин", null)).toBe(true);
    expect(matchesShopFilter(p, "", "Instytutum")).toBe(false);
    expect(matchesShopFilter(p, "retinal", null)).toBe(false);
  });
});
