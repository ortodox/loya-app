/** UX1 «Сегодня»: what needs doing in «Магазин» and «Склад препаратов», next to the clients. */
export type TodayTasks = {
  unpaid: { orderId: string; buyerName: string; left: number }[];
  handOver: { orderId: string; buyerName: string; pieces: number; ready: boolean }[];
  needToOrder: { productId: string; name: string; missing: number; buyers: string[] }[];
  stockMinus: { itemId: string; name: string; available: number; unit: "units" | "pieces" }[];
};

export const noTasks: TodayTasks = { unpaid: [], handOver: [], needToOrder: [], stockMinus: [] };

type OrderLike = { id: string; buyer: { name: string }; handedOverOn: string | null; total: { pieces: number }; payment: { left: number }; canHandOver: boolean };
type WaitingLike = { buyerName: string; missing: number };
type StockLike = { itemId: string; name: string; kind: "vials" | "pieces"; state: { available: number } };

/** UX1: unpaid orders (most owed first), orders waiting for hand-over (oldest first), what to order, stock below zero. */
export function todayTasks(
  orders: readonly OrderLike[],
  waiting: Readonly<Record<string, readonly WaitingLike[]>>,
  productNames: ReadonlyMap<string, string>,
  stock: readonly StockLike[],
): TodayTasks {
  return {
    unpaid: orders
      .filter((o) => o.payment.left > 0)
      .map((o) => ({ orderId: o.id, buyerName: o.buyer.name, left: o.payment.left }))
      .sort((a, b) => b.left - a.left),
    handOver: orders.filter((o) => !o.handedOverOn).map((o) => ({ orderId: o.id, buyerName: o.buyer.name, pieces: o.total.pieces, ready: o.canHandOver })),
    needToOrder: Object.entries(waiting).map(([productId, list]) => ({
      productId,
      name: productNames.get(productId) ?? "—",
      missing: list.reduce((s, w) => s + w.missing, 0),
      buyers: [...new Set(list.map((w) => w.buyerName))],
    })),
    stockMinus: stock.filter((s) => s.state.available < 0).map((s) => ({ itemId: s.itemId, name: s.name, available: s.state.available, unit: s.kind === "vials" ? "units" : "pieces" })),
  };
}

/** UX1: how many things wait – each order, product and preparation once (for the number on «Сегодня»). */
export function taskCount(tasks: TodayTasks): number {
  const orders = new Set([...tasks.unpaid.map((o) => o.orderId), ...tasks.handOver.map((o) => o.orderId)]);
  return orders.size + tasks.needToOrder.length + tasks.stockMinus.length;
}
