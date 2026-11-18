import { describe, expect, it } from "vitest";
import { tabCounts, taskCount, todayTasks } from "./today-tasks";

const order = (id: string, left: number, handedOverOn: string | null, missing: { name: string; missing: number }[] = []) => ({
  id,
  buyer: { name: `Покупатель ${id}` },
  handedOverOn,
  total: { pieces: 3 },
  payment: { left },
  canHandOver: missing.every((m) => m.missing === 0),
  lines: missing.length ? missing : [{ name: "Cream", missing: 0 }],
});

describe("TD2: «Сегодня» – Пора · Выдача · Закупка", () => {
  it("TD2: ready (green) and partial (yellow) apart; unpaid only for what was handed over", () => {
    const tasks = todayTasks(
      [order("a", 100, "2026-11-10"), order("b", 500, null, [{ name: "C-Tetra", missing: 1 }]), order("c", 0, null), order("d", 0, "2026-11-01"), order("e", 200, null)],
      { p1: [{ buyerName: "Анна", missing: 2 }, { buyerName: "Анна", missing: 1 }] },
      new Map([["p1", "C-Tetra"]]),
      [{ itemId: "s1", name: "Botox", kind: "vials", state: { available: -15 } }, { itemId: "s2", name: "Filler", kind: "pieces", state: { available: 3 } }],
    );
    expect(tasks.ready.map((r) => [r.orderId, r.left])).toEqual([["c", 0], ["e", 200]]);
    expect(tasks.partial).toEqual([{ orderId: "b", buyerName: "Покупатель b", pieces: 3, reserved: 2, waitsFor: [{ name: "C-Tetra", missing: 1 }] }]);
    expect(tasks.unpaid.map((u) => u.orderId)).toEqual(["a"]);
    expect(tasks.needToOrder).toEqual([{ productId: "p1", name: "C-Tetra", missing: 3, buyers: ["Анна"] }]);
    expect(tasks.stockMinus).toEqual([{ itemId: "s1", name: "Botox", available: -15, unit: "units" }]);
    expect(tabCounts(tasks)).toEqual({ handOver: 4, buy: 2, handOverUrgent: true, buyUrgent: true });
    expect(taskCount(tasks)).toBe(6);
  });
});
