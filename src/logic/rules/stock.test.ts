import { describe, expect, it } from "vitest";
import { parseVialSizes, simulateStock, type StockReceipt } from "./stock";

const receipt = (id: string, receivedOn: string, vialSize: number | null, count: number, extra: Partial<StockReceipt> = {}): StockReceipt => ({
  id,
  receivedOn,
  vialSize,
  count,
  openedOn: null,
  remaining: null,
  createdAt: receivedOn,
  ...extra,
});
const use = (date: string, amount: number | null) => ({ date, amount, createdAt: date });

describe("SK1: склад – ботокс флаконами", () => {
  it("SK1: units come out of the oldest open vial, the next one opens by itself that day", () => {
    const s = simulateStock(
      "vials",
      [receipt("r1", "2026-11-01", 100, 2), receipt("r2", "2026-11-01", 50, 1, { createdAt: "2026-11-01T2" })],
      [use("2026-11-03", 35), use("2026-11-04", 40), use("2026-11-05", 50)],
      [],
    );
    expect(s.available).toBe(125);
    expect(s.openVials).toEqual([{ key: "r1:1", size: 100, openedOn: "2026-11-05", remaining: 75 }]);
    expect(s.closed).toEqual([{ size: 50, count: 1 }]);
  });

  it("SK1: an already opened vial when stock-keeping begins is used first", () => {
    const s = simulateStock(
      "vials",
      [receipt("o", "2026-11-01", 100, 1, { openedOn: "2026-10-28", remaining: 60 }), receipt("r", "2026-11-01", 100, 1)],
      [use("2026-11-02", 20)],
      [],
    );
    expect(s.openVials).toEqual([{ key: "o:0", size: 100, openedOn: "2026-10-28", remaining: 40 }]);
    expect(s.available).toBe(140);
  });

  it("SK1: «Списать остаток» removes a vial, «Исправить остаток» sets what is left", () => {
    const s = simulateStock(
      "vials",
      [receipt("r", "2026-11-01", 100, 2)],
      [use("2026-11-02", 30)],
      [
        { happenedOn: "2026-11-03", kind: "discard", vialKey: "r:0", amount: null, createdAt: "a" },
        { happenedOn: "2026-11-03", kind: "set", vialKey: "r:1", amount: 80, createdAt: "b" },
      ],
    );
    expect(s.openVials).toEqual([{ key: "r:1", size: 100, openedOn: "2026-11-03", remaining: 80 }]);
    expect(s.available).toBe(80);
  });

  it("SK1: never below zero; botox without a number is counted apart, not taken off", () => {
    const s = simulateStock("vials", [receipt("r", "2026-11-01", 50, 1)], [use("2026-11-02", 80), use("2026-11-03", null)], []);
    expect(s.available).toBe(0);
    expect(s.unknown).toBe(1);
  });
});

describe("SK1: склад – штуки", () => {
  it("SK1: pieces in, one or the number written out, a correction sets the count", () => {
    expect(simulateStock("pieces", [receipt("r", "2026-11-01", null, 5)], [use("2026-11-02", 1), use("2026-11-03", 2)], []).available).toBe(2);
    expect(
      simulateStock("pieces", [receipt("r", "2026-11-01", null, 5)], [use("2026-11-02", 1)], [{ happenedOn: "2026-11-02", kind: "set", vialKey: null, amount: 7, createdAt: "x" }]).available,
    ).toBe(7);
    expect(simulateStock("pieces", [], [use("2026-11-02", 3)], []).available).toBe(0);
  });

  it("SK1: vial sizes – whole positive units, each once, smallest first", () => {
    expect(parseVialSizes(["100", "50", "100", " 200 ", "x", "-5"])).toEqual([50, 100, 200]);
    expect(parseVialSizes([""])).toBeNull();
  });
});

describe("SK3: история склада", () => {
  it("SK3 ✏️: a visit line keeps the quantity as typed", () => {
    const s = simulateStock("pieces", [receipt("r", "2026-11-01", null, 20)], [{ date: "2026-11-02", amount: 10, createdAt: "x", quantity: "10 штук" }], []);
    expect(s.history[0]).toMatchObject({ kind: "visit", change: -10, balance: 10, text: "10 штук" });
    const v = simulateStock("vials", [receipt("r", "2026-11-01", 100, 1)], [{ date: "2026-11-02", amount: null, createdAt: "x", quantity: "лоб 20" }], []);
    expect(v.history[0]).toMatchObject({ change: null, text: "лоб 20" });
    expect(v.history[1].text).toBeNull();
  });

  it("SK3: botox – receipts, visits (also without a number), discard and correction, with what is left after each, newest first", () => {
    const s = simulateStock(
      "vials",
      [receipt("r", "2026-11-01", 100, 2), receipt("o", "2026-11-01", 100, 1, { openedOn: "2026-10-28", remaining: 10 })],
      [use("2026-11-02", 20), use("2026-11-03", null)],
      [
        { happenedOn: "2026-11-04", kind: "discard", vialKey: "o:0", amount: null, createdAt: "a" },
        { happenedOn: "2026-11-05", kind: "set", vialKey: "r:0", amount: 85, createdAt: "b" },
      ],
    );
    expect(s.history.map((h) => [h.date, h.kind, h.change, h.balance])).toEqual([
      ["2026-11-05", "correct", -5, 185],
      ["2026-11-04", "discard", 0, 190],
      ["2026-11-03", "visit", null, 190],
      ["2026-11-02", "visit", -20, 190],
      ["2026-11-01", "receipt", 10, 210],
      ["2026-11-01", "receipt", 200, 200],
    ]);
    expect(s.history.at(-1)!.vials).toEqual({ size: 100, count: 2, opened: false });
    expect(s.history.at(-2)!.vials).toEqual({ size: 100, count: 1, opened: true });
  });

  it("SK3: a visit takes only what is there; pieces – receipts, visits and corrections", () => {
    expect(simulateStock("vials", [receipt("r", "2026-11-01", 50, 1)], [use("2026-11-02", 80)], []).history[0]).toMatchObject({ change: -50, balance: 0 });
    const p = simulateStock("pieces", [receipt("r", "2026-11-01", null, 5)], [use("2026-11-02", 2)], [{ happenedOn: "2026-11-03", kind: "set", vialKey: null, amount: 4, createdAt: "x" }]);
    expect(p.history.map((h) => [h.kind, h.change, h.balance])).toEqual([["correct", 1, 4], ["visit", -2, 3], ["receipt", 5, 5]]);
  });
});
