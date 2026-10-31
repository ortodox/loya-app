import { clientRepository, clientTrashRepository, documentStorage, photoStorage } from "@/data/repositories/server";
import type { TrashDeps } from "@/logic/usecases/trash";

/** Repositories for «Удалённые клиенты» (PR6), bound to the signed-in doctor. */
export async function trashDeps(): Promise<TrashDeps> {
  const [clients, trash, photos, documents] = await Promise.all([clientRepository(), clientTrashRepository(), photoStorage(), documentStorage()]);
  return { clients, trash, photos, documents };
}
