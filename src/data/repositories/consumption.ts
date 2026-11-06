import type { ConsumptionVisit } from "@/logic/rules/consumption";

/** RS1: all visits of active clients with their preparations, for «Расход»; Supabase implementation in ./consumption-supabase. */
export interface ConsumptionRepository {
  listVisits(): Promise<ConsumptionVisit[]>;
}
