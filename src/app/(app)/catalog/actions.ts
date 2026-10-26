"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { locales } from "@/config/locales";
import { catalogRepository } from "@/data/repositories/server";
import type { Localized } from "@/logic/catalog";
import {
  settingsFormFields,
  type CatalogFormErrors,
  type PreparationForm,
  type SettingsForm,
  type TypeForm,
} from "@/logic/rules/catalog-form";
import { savePreparation, saveType, type SaveResult } from "@/logic/usecases/catalog";

export type CatalogFormState<T> = { values: T; errors?: CatalogFormErrors; failed?: boolean };

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");
const localizedField = (fd: FormData, prefix: string): Localized =>
  Object.fromEntries(locales.map((l) => [l, str(fd.get(`${prefix}.${l}`))]));

function readSettings(fd: FormData): SettingsForm {
  return {
    ...Object.fromEntries(settingsFormFields.map((f) => [f, str(fd.get(f))])),
    advice: localizedField(fd, "advice"),
    adviceReview: fd.getAll("adviceReview").map(str),
  };
}

async function run<T>(values: T, save: () => Promise<SaveResult>, path: (id: string) => string) {
  let result: SaveResult;
  try {
    result = await save();
  } catch {
    return { values, failed: true };
  }
  if (!result.ok) return "errors" in result ? { values, errors: result.errors } : { values, failed: true };
  revalidatePath("/catalog", "layout");
  redirect(path(result.id));
}

export async function saveTypeAction(
  id: string | null,
  _: CatalogFormState<TypeForm>,
  fd: FormData,
): Promise<CatalogFormState<TypeForm>> {
  const values: TypeForm = {
    ...readSettings(fd),
    name: localizedField(fd, "name"),
    zoneIds: fd.getAll("zoneIds").map(str),
  };
  const repo = await catalogRepository();
  return run(values, () => saveType(repo, id, values), (typeId) => `/catalog/types/${typeId}`);
}

export async function savePreparationAction(
  id: string | null,
  _: CatalogFormState<PreparationForm>,
  fd: FormData,
): Promise<CatalogFormState<PreparationForm>> {
  const values: PreparationForm = {
    ...readSettings(fd),
    name: str(fd.get("name")),
    manufacturer: str(fd.get("manufacturer")),
    favorite: str(fd.get("favorite")),
    procedureTypeId: str(fd.get("procedureTypeId")),
  };
  const repo = await catalogRepository();
  return run(values, () => savePreparation(repo, id, values), (prepId) => `/catalog/preparations/${prepId}`);
}
