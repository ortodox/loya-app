"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { practiceTimeZone } from "@/config/time";
import { clientRepository, visitRepository } from "@/data/repositories/server";
import { todayIn } from "@/logic/rules/dates";
import type { VisitForm, VisitInputErrors } from "@/logic/rules/visits";
import { addVisit, deleteVisit, updateVisit, type SaveVisitResult } from "@/logic/usecases/visits";

export type VisitFormState = { values: VisitForm; errors?: VisitInputErrors; failed?: boolean };

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");

function readForm(formData: FormData): VisitForm {
  return {
    visitDate: str(formData.get("visitDate")),
    homeCareRecommendations: str(formData.get("homeCareRecommendations")),
    procedurePlan: str(formData.get("procedurePlan")),
  };
}

function backToCard(clientId: string): never {
  revalidatePath("/clients");
  revalidatePath(`/clients/${clientId}`);
  redirect(`/clients/${clientId}`);
}

async function save(
  clientId: string,
  formData: FormData,
  run: (form: VisitForm, today: string) => Promise<SaveVisitResult>,
): Promise<VisitFormState> {
  const values = readForm(formData);
  let result: SaveVisitResult;
  try {
    result = await run(values, todayIn(practiceTimeZone));
  } catch {
    return { values, failed: true };
  }
  if (!result.ok) return "errors" in result ? { values, errors: result.errors } : { values, failed: true };
  backToCard(clientId);
}

export async function createVisitAction(clientId: string, _: VisitFormState, formData: FormData) {
  const repos = { clients: await clientRepository(), visits: await visitRepository() };
  return save(clientId, formData, (form, today) => addVisit(repos, clientId, form, today));
}

export async function updateVisitAction(
  clientId: string,
  visitId: string,
  _: VisitFormState,
  formData: FormData,
) {
  const repo = await visitRepository();
  return save(clientId, formData, (form, today) => updateVisit(repo, clientId, visitId, form, today));
}

export async function deleteVisitAction(clientId: string, visitId: string): Promise<{ failed: true }> {
  let deleted = false;
  try {
    deleted = await deleteVisit(await visitRepository(), clientId, visitId);
  } catch {
    deleted = false;
  }
  if (!deleted) return { failed: true };
  backToCard(clientId);
}
