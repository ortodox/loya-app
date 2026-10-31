"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { practiceTimeZone } from "@/config/time";
import { clientRepository } from "@/data/repositories/server";
import { anamnesisFields } from "@/config/kartaTemplate";
import type { AnamnesisForm } from "@/logic/rules/anamnesis";
import { clientFormFields, type ClientForm, type ClientInputErrors } from "@/logic/rules/client-input";
import { todayIn } from "@/logic/rules/dates";
import { createClient, setMissingDirection, updateAnamnesisSection, updateClient, type SaveClientResult } from "@/logic/usecases/clients";

export type ClientFormState = {
  values: ClientForm;
  errors?: ClientInputErrors;
  failed?: boolean;
};

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");

function readForm(formData: FormData): ClientForm {
  const anamnesis: AnamnesisForm = Object.fromEntries(
    anamnesisFields.map((f) => [
      f.key,
      {
        choices: formData.getAll(`anamnesis.${f.key}.choices`).map(str),
        text: str(formData.get(`anamnesis.${f.key}.text`)),
      },
    ]),
  );
  return {
    ...Object.fromEntries(clientFormFields.map((f) => [f, str(formData.get(f))])),
    anamnesis,
    direction: formData.getAll("direction").map(str),
  };
}

async function save(
  formData: FormData,
  run: (form: ClientForm, today: string) => Promise<SaveClientResult>,
  created = false,
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
  redirect(created ? `/clients/${result.id}?created=1` : `/clients/${result.id}`);
}

export async function createClientAction(_: ClientFormState, formData: FormData) {
  const repo = await clientRepository();
  return save(formData, (form, today) => createClient(repo, form, today), true);
}

export async function updateClientAction(id: string, _: ClientFormState, formData: FormData) {
  const repo = await clientRepository();
  return save(formData, (form, today) => updateClient(repo, id, form, today));
}

/** DM1: «Направление не указано» – one tap in the card sets the direction. */
export async function setMissingDirectionAction(id: string, formData: FormData) {
  try {
    await setMissingDirection(await clientRepository(), id, str(formData.get("direction")));
  } catch {
    // The card simply shows the buttons again.
  }
  revalidatePath(`/clients/${id}`);
  revalidatePath("/clients");
}

/** AN3: «Изменить» on one section of «Анкета» – saves only that section, back to «Анкета» in the card. */
export async function updateAnamnesisSectionAction(id: string, section: string, _: { failed?: boolean }, formData: FormData): Promise<{ failed?: boolean }> {
  let ok = false;
  try {
    ok = await updateAnamnesisSection(await clientRepository(), id, section, readForm(formData).anamnesis ?? {});
  } catch {
    ok = false;
  }
  if (!ok) return { failed: true };
  revalidatePath(`/clients/${id}`);
  redirect(`/clients/${id}#anketa`);
}
