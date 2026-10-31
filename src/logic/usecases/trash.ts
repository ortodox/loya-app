import type { IsoDate } from "@/logic/client";
import { deleteWarnings, isExpired, purgeDate } from "@/logic/rules/trash";
import type { ClientRepository } from "@/data/repositories/clients";
import type { DocumentStorage } from "@/data/repositories/documents";
import type { PhotoStorage } from "@/data/repositories/photos";
import type { ClientTrashRepository } from "@/data/repositories/trash";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type TrashDeps = { clients: ClientRepository; trash: ClientTrashRepository; photos: PhotoStorage; documents: DocumentStorage };

/** PR6: what the confirmation shows – planned visits and an active course get an extra warning. */
export async function getDeleteWarnings(deps: Pick<TrashDeps, "clients">, clientId: string, today: IsoDate) {
  const client = uuid.test(clientId) ? await deps.clients.get(clientId) : null;
  return client ? deleteWarnings(client, today) : null;
}

/** PR6 «Удалить клиента»: the client moves to «Удалённые клиенты» – nothing is deleted yet. */
export async function moveClientToTrash(deps: Pick<TrashDeps, "clients" | "trash">, clientId: string, now: Date): Promise<boolean> {
  if (!uuid.test(clientId) || !(await deps.clients.get(clientId))) return false;
  return deps.trash.moveToTrash(clientId, now.toISOString());
}

/** PR6 «Восстановить»: back in the list with everything (only while it is still in the trash). */
export async function restoreClient(deps: Pick<TrashDeps, "trash">, clientId: string): Promise<boolean> {
  return uuid.test(clientId) ? deps.trash.restore(clientId) : false;
}

/** PR6 «Удалённые клиенты»: newest first, with the day each one is deleted for good. */
export async function listDeletedClients(deps: Pick<TrashDeps, "trash">, timeZone: string) {
  return (await deps.trash.listDeleted()).map((c) => ({ ...c, purgeOn: purgeDate(c.deletedAt, timeZone) }));
}

/**
 * PR6: after 30 days in the trash the client is deleted for good – first its files (Storage API),
 * then the row, which takes visits, courses, photos and documents with it. A client whose files
 * could not be removed is kept and tried again next time. Returns how many were deleted.
 */
export async function purgeExpiredClients(deps: Pick<TrashDeps, "trash" | "photos" | "documents">, now: Date): Promise<number> {
  let purged = 0;
  for (const client of await deps.trash.listDeleted()) {
    if (!isExpired(client.deletedAt, now)) continue;
    try {
      const files = await deps.trash.filesOf(client.id);
      if (files.photos.length > 0) await deps.photos.remove(files.photos);
      if (files.documents.length > 0) await deps.documents.remove(files.documents);
      if (await deps.trash.purge(client.id)) purged++;
    } catch {
      // Try again on the next run; the client stays in the trash meanwhile.
    }
  }
  return purged;
}
