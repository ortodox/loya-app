import type { IsoDate } from "@/logic/client";
import type { ShopRepository } from "@/data/repositories/shop";
import type { ShopOrdersRepository } from "@/data/repositories/shop-orders";
import { noTasks, todayTasks, type TodayTasks } from "@/logic/rules/today-tasks";
import { getOrders, getWaitingForStock } from "./shop-orders";
import { getStockOverview, type StockDeps } from "./stock";

/**
 * UX1 «Сегодня»: unpaid and waiting orders, «Нужно заказать» and preparations below zero. A part that cannot
 * be read is left out – «Сегодня» always opens.
 */
export async function getTodayTasks(
  shop: ShopRepository,
  orders: ShopOrdersRepository,
  stock: Pick<StockDeps, "stock" | "visits">,
  today: IsoDate,
): Promise<TodayTasks> {
  const [list, waiting, products, lines] = await Promise.all([
    getOrders(shop, orders, null).catch(() => null),
    getWaitingForStock(orders).catch(() => ({})),
    shop.listProducts().catch(() => []),
    getStockOverview(stock, today).catch(() => []),
  ]);
  if (!list && lines.length === 0) return noTasks;
  const all = list ? [...list.waiting, ...list.unpaid] : [];
  return todayTasks(all, waiting, new Map(products.map((p) => [p.id, p.name])), lines);
}
