"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { practiceTimeZone } from "@/config/time";
import { maxClientPhotosPerSave } from "@/logic/rules/client-photos";
import { todayIn } from "@/logic/rules/dates";
import { addClientPhotos, deleteClientPhoto, type AddClientPhotosResult } from "@/logic/usecases/client-photos";
import type { PhotoUpload } from "@/logic/usecases/visits";
import { clientPhotoDeps as deps } from "./deps";

export type ClientPhotoFormState = { takenOn: string; errors?: Extract<AddClientPhotosResult, { errors: unknown }>["errors"]; failed?: boolean };

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");

/** FK1/FK2/FK3: save 1–3 photos with the date taken – to «Фото клиента», or to the course. */
export async function addClientPhotosAction(clientId: string, courseId: string | null, _: ClientPhotoFormState, fd: FormData): Promise<ClientPhotoFormState> {
  const takenOn = str(fd.get("takenOn"));
  const files = fd.getAll("photos").filter((f): f is File => typeof f !== "string" && f.size > 0);
  const uploads: PhotoUpload[] = await Promise.all(
    files.slice(0, maxClientPhotosPerSave + 1).map(async (f) => ({ bytes: new Uint8Array(await f.arrayBuffer()), type: f.type, size: f.size })),
  );
  let result: AddClientPhotosResult;
  try {
    result = await addClientPhotos(await deps(), clientId, { takenOn, courseId: courseId ?? undefined }, uploads, todayIn(practiceTimeZone));
  } catch {
    return { takenOn, failed: true };
  }
  if (!result.ok) return "errors" in result ? { takenOn, errors: result.errors } : { takenOn, failed: true };
  revalidatePath(`/clients/${clientId}`);
  redirect(`/clients/${clientId}#${courseId ? `course-${courseId}` : "client-photos"}`);
}

/** FK4: delete a photo – asked first in the UI. */
export async function deleteClientPhotoAction(clientId: string, photoId: string): Promise<{ ok: boolean }> {
  let ok = false;
  try {
    ok = await deleteClientPhoto(await deps(), clientId, photoId);
  } catch {
    ok = false;
  }
  if (ok) revalidatePath(`/clients/${clientId}`);
  return { ok };
}
