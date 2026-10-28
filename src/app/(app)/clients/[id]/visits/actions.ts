"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { practiceTimeZone } from "@/config/time";
import { todayIn } from "@/logic/rules/dates";
import type { VisitForm, VisitInputErrors, VisitItemForm } from "@/logic/rules/visits";
import { deleteVisit, saveVisit, type PhotoUpload, type SaveVisitResult } from "@/logic/usecases/visits";
import { visitDeps as deps } from "./deps";

export type VisitFormState = { values: VisitForm; errors?: VisitInputErrors; failed?: boolean };

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");

function readItems(raw: string): VisitItemForm[] {
  try {
    const parsed: unknown = JSON.parse(raw || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, 50).map((x) => {
      const o = (x ?? {}) as Record<string, unknown>;
      const s = (k: string) => (typeof o[k] === "string" ? (o[k] as string) : undefined);
      return { preparationId: s("preparationId"), manualName: s("manualName"), manualTypeId: s("manualTypeId"), quantity: s("quantity") };
    });
  } catch {
    return [];
  }
}

function readForm(fd: FormData): VisitForm {
  return {
    visitDate: str(fd.get("visitDate")),
    notes: str(fd.get("notes")),
    recommendations: str(fd.get("recommendations")),
    recommendationsLang: str(fd.get("recommendationsLang")),
    recommendationsEdited: str(fd.get("recommendationsEdited")),
    anamnesisConfirmed: str(fd.get("anamnesisConfirmed")),
    faceScheme: str(fd.get("faceScheme")),
    items: readItems(str(fd.get("items"))),
  };
}

async function readPhotos(fd: FormData): Promise<{ add: PhotoUpload[]; removeIds: string[] }> {
  const files = fd.getAll("photos").filter((f): f is File => typeof f !== "string" && f.size > 0);
  const add = await Promise.all(
    files.slice(0, 4).map(async (f) => ({ bytes: new Uint8Array(await f.arrayBuffer()), type: f.type, size: f.size })),
  );
  return { add, removeIds: fd.getAll("removePhotoIds").map(str).filter(Boolean) };
}

function backToCard(clientId: string): never {
  revalidatePath("/clients");
  revalidatePath(`/clients/${clientId}`);
  redirect(`/clients/${clientId}`);
}

export async function saveVisitAction(
  clientId: string,
  visitId: string | null,
  _: VisitFormState,
  fd: FormData,
): Promise<VisitFormState> {
  const values = readForm(fd);
  let result: SaveVisitResult;
  try {
    result = await saveVisit(await deps(), clientId, visitId, values, await readPhotos(fd), todayIn(practiceTimeZone));
  } catch {
    return { values, failed: true };
  }
  if (!result.ok) return "errors" in result ? { values, errors: result.errors } : { values, failed: true };
  backToCard(clientId);
}

export async function deleteVisitAction(clientId: string, visitId: string): Promise<{ failed: true }> {
  let deleted = false;
  try {
    deleted = await deleteVisit(await deps(), clientId, visitId);
  } catch {
    deleted = false;
  }
  if (!deleted) return { failed: true };
  backToCard(clientId);
}
