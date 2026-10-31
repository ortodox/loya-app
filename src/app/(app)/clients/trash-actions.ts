"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { moveClientToTrash, restoreClient } from "@/logic/usecases/trash";
import { trashDeps } from "./trash-deps";

/** PR6 «Удалить клиента»: to «Удалённые клиенты», back to the list. */
export async function deleteClientAction(clientId: string): Promise<{ ok: false }> {
  let ok = false;
  try {
    ok = await moveClientToTrash(await trashDeps(), clientId, new Date());
  } catch {
    ok = false;
  }
  if (!ok) return { ok: false };
  revalidatePath("/clients");
  redirect("/clients");
}

/** PR6 «Восстановить»: back in the list, open the card again. */
export async function restoreClientAction(clientId: string): Promise<void> {
  let ok = false;
  try {
    ok = await restoreClient(await trashDeps(), clientId);
  } catch {
    ok = false;
  }
  revalidatePath("/clients");
  redirect(ok ? `/clients/${clientId}` : "/clients/deleted?failed=1");
}
