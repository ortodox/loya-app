import type { IsoDate, Visit } from "@/logic/client";
import { parseVisitForm, sortVisitsNewestFirst, type VisitForm, type VisitInputErrors } from "@/logic/rules/visits";
import type { ClientRepository } from "@/data/repositories/clients";
import type { VisitRepository } from "@/data/repositories/visits";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type SaveVisitResult =
  | { ok: true; id: string }
  | { ok: false; errors: VisitInputErrors }
  | { ok: false; notFound: true };

/** VS1: the client's visits, newest first. */
export async function listVisits(repo: VisitRepository, clientId: string): Promise<Visit[]> {
  if (!uuid.test(clientId)) return [];
  return sortVisitsNewestFirst(await repo.listByClient(clientId));
}

/** VS1: one visit, only when it belongs to the client in the URL. */
export async function getVisit(
  repo: VisitRepository,
  clientId: string,
  visitId: string,
): Promise<Visit | null> {
  if (!uuid.test(clientId) || !uuid.test(visitId)) return null;
  const visit = await repo.get(visitId);
  return visit && visit.clientId === clientId ? visit : null;
}

/** VS1: add a visit to an existing client. */
export async function addVisit(
  repos: { clients: ClientRepository; visits: VisitRepository },
  clientId: string,
  form: VisitForm,
  today: IsoDate,
): Promise<SaveVisitResult> {
  if (!uuid.test(clientId) || !(await repos.clients.get(clientId))) return { ok: false, notFound: true };
  const parsed = parseVisitForm(form, today);
  if (!parsed.ok) return parsed;
  return { ok: true, ...(await repos.visits.create(clientId, parsed.input)) };
}

/** VS1: edit a visit. */
export async function updateVisit(
  repo: VisitRepository,
  clientId: string,
  visitId: string,
  form: VisitForm,
  today: IsoDate,
): Promise<SaveVisitResult> {
  if (!(await getVisit(repo, clientId, visitId))) return { ok: false, notFound: true };
  const parsed = parseVisitForm(form, today);
  if (!parsed.ok) return parsed;
  return (await repo.update(visitId, parsed.input)) ? { ok: true, id: visitId } : { ok: false, notFound: true };
}

/** VS1: delete a visit (the UI asks for confirmation first). */
export async function deleteVisit(repo: VisitRepository, clientId: string, visitId: string): Promise<boolean> {
  if (!(await getVisit(repo, clientId, visitId))) return false;
  return repo.delete(visitId);
}
