"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { practiceTimeZone } from "@/config/time";
import { todayIn } from "@/logic/rules/dates";
import { saveCare, type SaveCareResult } from "@/logic/usecases/care";
import type { PhotoUpload } from "@/logic/usecases/visits";
import { careDeps as deps } from "./deps";

export type CareFormState = { text: string; errors?: Extract<SaveCareResult, { errors: unknown }>["errors"]; failed?: boolean };

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");

/** UH1/UH2: save «Уход» – text, new and removed photos. */
export async function saveCareAction(clientId: string, _: CareFormState, fd: FormData): Promise<CareFormState> {
  const text = str(fd.get("text"));
  const files = fd.getAll("photos").filter((f): f is File => typeof f !== "string" && f.size > 0);
  const add: PhotoUpload[] = await Promise.all(
    files.slice(0, 4).map(async (f) => ({ bytes: new Uint8Array(await f.arrayBuffer()), type: f.type, size: f.size })),
  );
  let result: SaveCareResult;
  try {
    result = await saveCare(await deps(), clientId, { text }, { add, removeIds: fd.getAll("removePhotoIds").map(str) }, todayIn(practiceTimeZone));
  } catch {
    return { text, failed: true };
  }
  if (!result.ok) return "errors" in result ? { text, errors: result.errors } : { text, failed: true };
  revalidatePath(`/clients/${clientId}`);
  redirect(`/clients/${clientId}`);
}
