"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { practiceTimeZone } from "@/config/time";
import { clientRepository } from "@/data/repositories";
import type { ClientForm } from "@/logic/rules/client-input";
import { todayIn } from "@/logic/rules/dates";
import { createClient, updateClient, type SaveClientResult } from "@/logic/usecases/clients";

export type ClientFormState = {
  values: ClientForm;
  errors?: Extract<SaveClientResult, { errors: unknown }>["errors"];
  failed?: boolean;
};

const fields = ["fullName", "cardDate", "age", "birthDate", "phone", "language", "notes"] as const;

function readForm(formData: FormData): ClientForm {
  return Object.fromEntries(
    fields.map((f) => [f, typeof formData.get(f) === "string" ? (formData.get(f) as string) : ""]),
  );
}

async function save(
  formData: FormData,
  run: (form: ClientForm, today: string) => Promise<SaveClientResult>,
): Promise<ClientFormState> {
  const values = readForm(formData);
  let result: SaveClientResult;
  try {
    result = await run(values, todayIn(practiceTimeZone));
  } catch {
    return { values, failed: true };
  }
  if (!result.ok) return "errors" in result ? { values, errors: result.errors } : { values, failed: true };

  revalidatePath("/clients");
  redirect(`/clients/${result.id}`);
}

export async function createClientAction(_: ClientFormState, formData: FormData) {
  const repo = await clientRepository();
  return save(formData, (form, today) => createClient(repo, form, today));
}

export async function updateClientAction(id: string, _: ClientFormState, formData: FormData) {
  const repo = await clientRepository();
  return save(formData, (form, today) => updateClient(repo, id, form, today));
}
