import type { IsoDate } from "@/logic/client";
import { consumption, isMonth, monthOf, type Consumption } from "@/logic/rules/consumption";
import type { ConsumptionRepository } from "@/data/repositories/consumption";

/** RS1 «Расход»: the month asked for (this month when missing, invalid or in the future). */
export async function getConsumption(repo: ConsumptionRepository, month: string | undefined, today: IsoDate): Promise<Consumption> {
  const current = monthOf(today);
  const shown = isMonth(month) && month <= current ? month : current;
  return consumption(await repo.listVisits(), shown, today);
}
