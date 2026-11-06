import { catalogRepository, consumptionRepository, stockRepository } from "@/data/repositories/server";
import type { StockDeps } from "@/logic/usecases/stock";

/** SK1: the repositories «Склад» needs, bound to the signed-in doctor. */
export async function stockDeps(): Promise<StockDeps> {
  const [stock, visits, catalog] = await Promise.all([stockRepository(), consumptionRepository(), catalogRepository()]);
  return { stock, visits, catalog };
}
