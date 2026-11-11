"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { withSaved } from "@/logic/rules/saved";
import { clientRepository } from "@/data/repositories/server";
import { updateNotes } from "@/logic/usecases/clients";

/** ZM1: save «Заметки» from the card – only the notes, back to them in the card. */
export async function saveNotesAction(clientId: string, _: { failed?: boolean }, fd: FormData): Promise<{ failed?: boolean }> {
  const text = typeof fd.get("notes") === "string" ? (fd.get("notes") as string) : "";
  let ok = false;
  try {
    ok = await updateNotes(await clientRepository(), clientId, text);
  } catch {
    ok = false;
  }
  if (!ok) return { failed: true };
  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/clients");
  redirect(withSaved(`/clients/${clientId}#notes`));
}
