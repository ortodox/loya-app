"use server";

import { revalidatePath } from "next/cache";
import { practiceTimeZone } from "@/config/time";
import { todayIn } from "@/logic/rules/dates";
import type { DocumentForm } from "@/logic/rules/documents";
import { deleteDocument, prepareDocumentUpload, registerDocument } from "@/logic/usecases/documents";
import { documentDeps as deps } from "./deps";

type Failure = { ok: false; error: "fileInvalid" | "dateInvalid" | "notFound" | "failed" };

/** DK1, step 1: a one-time link for uploading the file straight from the phone to Storage. */
export async function prepareUploadAction(
  clientId: string,
  file: { type: string; size: number },
): Promise<{ ok: true; path: string; uploadUrl: string } | Failure> {
  try {
    return await prepareDocumentUpload(await deps(), clientId, file);
  } catch {
    return { ok: false, error: "failed" };
  }
}

/** DK1/LE8, step 2: save title, date and course for the uploaded file. */
export async function registerDocumentAction(
  clientId: string,
  file: { path: string; type: string; size: number },
  form: DocumentForm,
): Promise<{ ok: true } | Failure> {
  try {
    const result = await registerDocument(await deps(), clientId, file, form, todayIn(practiceTimeZone));
    if (!result.ok) return result;
  } catch {
    return { ok: false, error: "failed" };
  }
  revalidatePath(`/clients/${clientId}`);
  return { ok: true };
}

/** DK5: delete the file and its row. */
export async function deleteDocumentAction(clientId: string, documentId: string): Promise<{ ok: boolean }> {
  let ok = false;
  try {
    ok = await deleteDocument(await deps(), clientId, documentId);
  } catch {
    ok = false;
  }
  if (ok) revalidatePath(`/clients/${clientId}`);
  return { ok };
}
