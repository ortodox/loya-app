/**
 * UX1/TD2 «Сегодня»: what needs doing in «Магазин» and «Склад препаратов», next to the clients, in three
 * tabs – «⏰ Пора» (clients), «📦 Выдача» (hand-over and payment), «🛒 Закупка» (what to buy).
 */
export type TodayTasks = {
  /** 🟢 everything put aside – can be handed over; with what is still to pay. */
  ready: { orderId: string; buyerName: string; pieces: number; left: number }[];
  /** 🟡 part put aside, part still missing – «2 из 3 шт», «ждёт: C-Tetra 1 шт». */
  partial: { orderId: string; buyerName: string; pieces: number; reserved: number; waitsFor: { name: string; missing: number }[] }[];
  /** 🔴 handed over but not (fully) paid, most owed first. */
  unpaid: { orderId: string; buyerName: string; left: number }[];
  needToOrder: { productId: string; name: string; missing: number; buyers: string[] }[];
  stockMinus: { itemId: string; name: string; available: number; unit: "units" | "pieces" }[];
};

export const noTasks: TodayTasks = { ready: [], partial: [], unpaid: [], needToOrder: [], stockMinus: [] };

type OrderLike = {
  id: string;
  buyer: { name: string };
  handedOverOn: string | null;
  total: { pieces: number };
  payment: { left: number };
  canHandOver: boolean;
  lines: readonly { name: string; missing: number }[];
};
type WaitingLike = { buyerName: string; missing: number };
type StockLike = { itemId: string; name: string; kind: "vials" | "pieces"; state: { available: number } };

/** TD2: orders not handed over split into ready and partial (oldest first, as given); unpaid hand-overs; what to buy. */
export function todayTasks(
  orders: readonly OrderLike[],
  waiting: Readonly<Record<string, readonly WaitingLike[]>>,
  productNames: ReadonlyMap<string, string>,
  stock: readonly StockLike[],
): TodayTasks {
  const open = orders.filter((o) => !o.handedOverOn);
  return {
    ready: open.filter((o) => o.canHandOver).map((o) => ({ orderId: o.id, buyerName: o.buyer.name, pieces: o.total.pieces, left: o.payment.left })),
    partial: open
      .filter((o) => !o.canHandOver)
      .map((o) => {
        const waitsFor = o.lines.filter((l) => l.missing > 0).map((l) => ({ name: l.name, missing: l.missing }));
        return { orderId: o.id, buyerName: o.buyer.name, pieces: o.total.pieces, reserved: o.total.pieces - waitsFor.reduce((s, w) => s + w.missing, 0), waitsFor };
      }),
    unpaid: orders
      .filter((o) => o.handedOverOn && o.payment.left > 0)
      .map((o) => ({ orderId: o.id, buyerName: o.buyer.name, left: o.payment.left }))
      .sort((a, b) => b.left - a.left),
    needToOrder: Object.entries(waiting).map(([productId, list]) => ({
      productId,
      name: productNames.get(productId) ?? "—",
      missing: list.reduce((s, w) => s + w.missing, 0),
      buyers: [...new Set(list.map((w) => w.buyerName))],
    })),
    stockMinus: stock.filter((s) => s.state.available < 0).map((s) => ({ itemId: s.itemId, name: s.name, available: s.state.available, unit: s.kind === "vials" ? "units" : "pieces" })),
  };
}

/** TD2: the number on «📦 Выдача» and «🛒 Закупка», and whether a tab has something urgent (red dot). */
export function tabCounts(tasks: TodayTasks): { handOver: number; buy: number; handOverUrgent: boolean; buyUrgent: boolean } {
  return {
    handOver: tasks.ready.length + tasks.partial.length + tasks.unpaid.length,
    buy: tasks.needToOrder.length + tasks.stockMinus.length,
    handOverUrgent: tasks.unpaid.length > 0 || tasks.ready.some((r) => r.left > 0),
    buyUrgent: tasks.stockMinus.length > 0,
  };
}

/** UX1: how many things wait in the shop and stock (for the number on the «Сегодня» tab). */
export function taskCount(tasks: TodayTasks): number {
  const counts = tabCounts(tasks);
  return counts.handOver + counts.buy;
}
