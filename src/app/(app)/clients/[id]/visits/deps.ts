import { catalogRepository, clientRepository, photoStorage, visitRepository } from "@/data/repositories/server";
import type { VisitDeps } from "@/logic/usecases/visits";

/** Repositories for the visit pages and actions, bound to the signed-in doctor. */
export async function visitDeps(): Promise<VisitDeps> {
  const [clients, visits, catalog, photos] = await Promise.all([
    clientRepository(),
    visitRepository(),
    catalogRepository(),
    photoStorage(),
  ]);
  return { clients, visits, catalog, photos };
}
