import { describe, expect, it } from "vitest";
import { taskCount, todayTasks } from "./today-tasks";

const order = (id: string, left: number, handedOverOn: string | null, canHandOver = true) => ({ id, buyer: { name: `Покупатель ${id}` }, handedOverOn, total: { pieces: 2 }, payment: { left }, canHandOver });

describe("UX1: «Сегодня» – всё, что нужно сделать", () => {
  it("UX1: unpaid (most owed first), waiting for hand-over, what to order, stock below zero", () => {
    const tasks = todayTasks(
      [order("a", 100, "2026-11-10"), order("b", 500, null, false), order("c", 0, null), order("d", 0, "2026-11-01")],
      { p1: [{ buyerName: "Анна", missing: 2 }, { buyerName: "Анна", missing: 1 }] },
      new Map([["p1", "C-Tetra"]]),
      [{ itemId: "s1", name: "Botox", kind: "vials", state: { available: -15 } }, { itemId: "s2", name: "Filler", kind: "pieces", state: { available: 3 } }],
    );
    expect(tasks.unpaid.map((u) => [u.orderId, u.left])).toEqual([["b", 500], ["a", 100]]);
    expect(tasks.handOver.map((h) => [h.orderId, h.ready])).toEqual([["b", false], ["c", true]]);
    expect(tasks.needToOrder).toEqual([{ productId: "p1", name: "C-Tetra", missing: 3, buyers: ["Анна"] }]);
    expect(tasks.stockMinus).toEqual([{ itemId: "s1", name: "Botox", available: -15, unit: "units" }]);
    // a, b, c (b once) + 1 product + 1 preparation
    expect(taskCount(tasks)).toBe(5);
  });
});
