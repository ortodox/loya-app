import { describe, expect, it } from "vitest";
import type { ShopRepository } from "@/data/repositories/shop";
import type { ShopMovement, ShopProduct } from "@/logic/rules/shop";
import { deleteShopHistoryLine, getShop, getShopSales, returnShopSale, saveShopProduct, tapShopProduct, toggleShopFavorite, undoShopTap } from "./shop";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const today = "2026-11-10";

function setup() {
  let n = 100;
  const products: ShopProduct[] = [
    { id: id(1), brand: "Medik8", category: "Витамин C", name: "C-Tetra", size: "30 ml", currency: "PLN", price: 230.41, favorite: false, active: true, sortOrder: 10 },
    { id: id(2), brand: "Instytutum", category: "Сыворотки", name: "Retinol Serum", size: "10 ml", currency: "EUR", price: 55, favorite: false, active: true, sortOrder: 20 },
    { id: id(3), brand: "Medik8", category: "Другое", name: "Hidden", size: "", currency: "PLN", price: 1, favorite: false, active: false, sortOrder: 30 },
  ];
  const movements: ShopMovement[] = [];
  const repo: ShopRepository = {
    listProducts: async () => products.map((p) => ({ ...p })),
    getProduct: async (pid) => products.find((p) => p.id === pid) ?? null,
    createProduct: async (input) => {
      const pid = id(n++);
      products.push({ ...input, id: pid, sortOrder: 999 });
      return { id: pid };
    },
    updateProduct: async (pid, input) => {
      const p = products.find((x) => x.id === pid);
      if (!p) return false;
      Object.assign(p, input);
      return true;
    },
    setFavorite: async (pid, favorite) => {
      const p = products.find((x) => x.id === pid);
      if (p) p.favorite = favorite;
      return Boolean(p);
    },
    listMovements: async () => movements.map((m) => ({ ...m })),
    addMovement: async (input) => {
      const mid = id(n++);
      movements.push({ ...input, id: mid, createdAt: `${input.happenedOn}T10:00:${String(n).padStart(2, "0")}Z` });
      return { id: mid };
    },
    deleteMovement: async (mid) => {
      const k = movements.findIndex((m) => m.id === mid && !m.orderItemId);
      if (k >= 0) movements.splice(k, 1);
      return k >= 0;
    },
    markReturned: async (mid, on) => {
      const m = movements.find((x) => x.id === mid && !x.returnedOn);
      if (m) Object.assign(m, { returnedOn: on, returnedAt: `${on}T15:00:00Z` });
      return Boolean(m);
    },
    deleteMovements: async (pid, date, kind) => {
      const before = movements.length;
      for (let i = movements.length - 1; i >= 0; i--) if (movements[i].productId === pid && movements[i].happenedOn === date && movements[i].kind === kind) movements.splice(i, 1);
      return before - movements.length;
    },
  };
  return { repo, products, movements };
}

describe("MG2: «−» и «+» в магазине", () => {
  it("MG2: «+» adds one, «−» sells one at today's price; hidden products are not shown", async () => {
    const { repo, movements, products } = setup();
    expect(await tapShopProduct(repo, id(1), "receipt", today)).toBeTruthy();
    expect(await tapShopProduct(repo, id(1), "receipt", today)).toBeTruthy();
    expect(await tapShopProduct(repo, id(1), "sale", today)).toBeTruthy();
    expect(movements[2]).toMatchObject({ kind: "sale", price: 230.41, currency: "PLN" });
    products[0].price = 250; // a later price change does not change the sale already made
    const { lines, brands } = await getShop(repo);
    expect(lines.map((l) => [l.name, l.stock])).toEqual([["Retinol Serum", 0], ["C-Tetra", 1]]);
    expect(lines[1].history.map((h) => [h.kind, h.quantity, h.balance])).toEqual([["sale", 1, 1], ["receipt", 2, 2]]);
    expect(brands).toEqual(["Instytutum", "Medik8"]);
    expect(await tapShopProduct(repo, "nope", "sale", today)).toBeNull();
  });

  it("MG2: «Удалить» a line removes that day's sales of the product", async () => {
    const { repo } = setup();
    await tapShopProduct(repo, id(1), "receipt", "2026-11-01");
    await tapShopProduct(repo, id(1), "receipt", "2026-11-01");
    await tapShopProduct(repo, id(1), "sale", today);
    await tapShopProduct(repo, id(1), "sale", today);
    expect(await deleteShopHistoryLine(repo, id(1), today, "sale")).toBe("ok");
    expect((await getShop(repo)).lines.find((l) => l.id === id(1))!.stock).toBe(2);
    expect(await deleteShopHistoryLine(repo, id(1), today, "other")).toBe("invalid");
  });

  it("MG6: «Нет, исправление» lowers the stock but is not a sale", async () => {
    const { repo, movements } = setup();
    await tapShopProduct(repo, id(1), "receipt", today);
    await tapShopProduct(repo, id(1), "receipt", today);
    expect(await tapShopProduct(repo, id(1), "correction", today)).toBeTruthy();
    expect(movements[2]).toMatchObject({ kind: "correction", price: null, currency: null });
    expect((await getShop(repo)).lines.find((l) => l.id === id(1))!.stock).toBe(1);
    expect((await getShopSales(repo, undefined, today)).sales.pieces).toBe(0);
  });

  it("MG7: «−» does nothing at 0; a delivery already sold cannot be deleted", async () => {
    const { repo, movements } = setup();
    expect(await tapShopProduct(repo, id(1), "sale", today)).toBeNull();
    expect(await tapShopProduct(repo, id(1), "correction", today)).toBeNull();
    expect(movements).toHaveLength(0);
    await tapShopProduct(repo, id(1), "receipt", "2026-11-01");
    await tapShopProduct(repo, id(1), "sale", today);
    expect(await deleteShopHistoryLine(repo, id(1), "2026-11-01", "receipt")).toBe("negative");
    expect(movements).toHaveLength(2);
  });
});

describe("MG3/MG4/MG1: продажи, избранное, товар", () => {
  it("MG3: sales of the month asked for, never a future month", async () => {
    const { repo } = setup();
    await tapShopProduct(repo, id(1), "receipt", today);
    await tapShopProduct(repo, id(2), "receipt", today);
    await tapShopProduct(repo, id(1), "sale", today);
    await tapShopProduct(repo, id(2), "sale", today);
    const { sales } = await getShopSales(repo, "2026-12", today);
    expect(sales.month).toBe("2026-11");
    expect(sales.value).toEqual({ PLN: 230.41, EUR: 55 });
  });

  it("MG4: ⭐ toggles and puts the product first", async () => {
    const { repo } = setup();
    expect(await toggleShopFavorite(repo, id(1))).toBe(true);
    expect((await getShop(repo)).lines[0].name).toBe("C-Tetra");
  });

  it("MG1: «+ Товар» needs a name, brand, price and currency; Loya can change the price", async () => {
    const { repo, products } = setup();
    expect(await saveShopProduct(repo, null, { brand: "", name: "", price: "x", currency: "USD" })).toEqual({
      ok: false,
      errors: { brand: "required", name: "required", price: "invalid", currency: "invalid" },
    });
    const created = await saveShopProduct(repo, null, { brand: "Medik8", name: "New", price: "99,90", currency: "PLN", favorite: "on" });
    expect(created.ok).toBe(true);
    expect(products.at(-1)).toMatchObject({ name: "New", price: 99.9, favorite: true, active: true });
    expect(await saveShopProduct(repo, id(1), { brand: "Medik8", name: "C-Tetra", price: "240", currency: "PLN", hidden: "on" })).toEqual({ ok: true, id: id(1) });
    expect(products[0]).toMatchObject({ price: 240, active: false });
  });
});

describe("MG13: исправить продажу", () => {
  it("MG13: «Исправить» → «Да» gives the newest sale back: stock +1, out of «Продажи», «Возврат +1» in «История»", async () => {
    const { repo, movements } = setup();
    await tapShopProduct(repo, id(1), "receipt", "2026-11-01");
    await tapShopProduct(repo, id(1), "receipt", "2026-11-01");
    await tapShopProduct(repo, id(1), "sale", "2026-11-05");
    await tapShopProduct(repo, id(1), "sale", "2026-11-08");
    expect(await returnShopSale(repo, id(1), "2026-11", "PLN", today)).toBe(true);
    expect(movements.find((m) => m.happenedOn === "2026-11-08")?.returnedOn).toBe(today);
    const line = (await getShop(repo)).lines.find((l) => l.id === id(1))!;
    expect(line.stock).toBe(1);
    expect(line.history.map((h) => [h.date, h.kind, h.quantity, h.balance])).toEqual([
      [today, "return", 1, 1],
      ["2026-11-08", "sale", 1, 0],
      ["2026-11-05", "sale", 1, 1],
      ["2026-11-01", "receipt", 2, 2],
    ]);
    const { sales } = await getShopSales(repo, "2026-11", today);
    expect([sales.pieces, sales.value.PLN]).toEqual([1, 230.41]);
  });

  it("MG13: nothing to give back – no sale that month, wrong month or currency", async () => {
    const { repo } = setup();
    expect(await returnShopSale(repo, id(1), "2026-11", "PLN", today)).toBe(false);
    expect(await returnShopSale(repo, id(1), "2026-13", "PLN", today)).toBe(false);
    expect(await returnShopSale(repo, "nope", "2026-11", "PLN", today)).toBe(false);
  });
});

describe("UX3/UX6: отменить и поступление количеством", () => {
  it("UX6: «Сколько пришло?» – several at once (1–100); «−» always one", async () => {
    const { repo } = setup();
    expect(await tapShopProduct(repo, id(1), "receipt", today, 12)).toBeTruthy();
    expect((await getShop(repo)).lines.find((l) => l.id === id(1))!.stock).toBe(12);
    expect(await tapShopProduct(repo, id(1), "receipt", today, 0)).toBeNull();
    expect(await tapShopProduct(repo, id(1), "receipt", today, 101)).toBeNull();
    expect(await tapShopProduct(repo, id(1), "sale", today, 2)).toBeNull();
  });

  it("UX3: «Отменить» takes the tap back; a delivery already sold cannot be taken back (MG7)", async () => {
    const { repo } = setup();
    const receipt = (await tapShopProduct(repo, id(1), "receipt", today))!;
    const sale = (await tapShopProduct(repo, id(1), "sale", today))!;
    expect(await undoShopTap(repo, receipt)).toBe(false);
    expect(await undoShopTap(repo, sale)).toBe(true);
    expect(await undoShopTap(repo, receipt)).toBe(true);
    expect((await getShop(repo)).lines.find((l) => l.id === id(1))!.stock).toBe(0);
  });
});
