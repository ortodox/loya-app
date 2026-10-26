import type { Preparation, ProcedureType, Zone } from "@/logic/catalog";
import {
  parsePreparationForm,
  parseTypeForm,
  type CatalogFormErrors,
  type PreparationForm,
  type TypeForm,
} from "@/logic/rules/catalog-form";
import { sortPreparations } from "@/logic/rules/catalog-list";
import {
  effectivePreparationSettings,
  missingSettings,
  type EffectiveSettings,
  type MissingItem,
} from "@/logic/rules/catalog-settings";
import { DuplicateNameError, type CatalogRepository } from "@/data/repositories/catalog";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type TypeSummary = { type: ProcedureType; preparationCount: number; missing: MissingItem[] };

export type CatalogOverview = {
  types: TypeSummary[];
  /** All preparations for search (P1), favourites first. */
  preparations: Preparation[];
};

/** B1: procedure types with their number of preparations and what is still «заполнить». */
export async function getCatalogOverview(repo: CatalogRepository): Promise<CatalogOverview> {
  const [types, preparations] = await Promise.all([repo.listTypes(), repo.listPreparations()]);
  return {
    types: [...types]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((type) => ({
        type,
        preparationCount: preparations.filter((p) => p.procedureTypeId === type.id).length,
        missing: missingSettings(type, type.zoneIds.length),
      })),
    preparations: sortPreparations(preparations),
  };
}

export type TypeDetail = {
  type: ProcedureType;
  zones: Zone[];
  preparations: Preparation[];
  missing: MissingItem[];
};

/** B1/P2: a procedure type with its defaults, allowed zones and preparations (favourites first). */
export async function getTypeDetail(repo: CatalogRepository, id: string): Promise<TypeDetail | null> {
  if (!uuid.test(id)) return null;
  const [type, zones, preparations] = await Promise.all([repo.getType(id), repo.listZones(), repo.listPreparations()]);
  if (!type) return null;
  return {
    type,
    zones,
    preparations: sortPreparations(preparations.filter((p) => p.procedureTypeId === id)),
    missing: missingSettings(type, type.zoneIds.length),
  };
}

export type PreparationDetail = {
  preparation: Preparation;
  type: ProcedureType;
  /** P3/P5: the type's values with the preparation's exceptions applied. */
  effective: EffectiveSettings;
  missing: MissingItem[];
};

export async function getPreparationDetail(
  repo: CatalogRepository,
  id: string,
): Promise<PreparationDetail | null> {
  if (!uuid.test(id)) return null;
  const preparation = await repo.getPreparation(id);
  if (!preparation) return null;
  const type = await repo.getType(preparation.procedureTypeId);
  if (!type) return null;
  const effective = effectivePreparationSettings(type, preparation);
  return { preparation, type, effective, missing: missingSettings(effective.settings) };
}

export type SaveResult = { ok: true; id: string } | { ok: false; errors: CatalogFormErrors } | { ok: false; notFound: true };

/** B1: create (id = null) or edit a procedure type. Only existing zones can be allowed. */
export async function saveType(repo: CatalogRepository, id: string | null, form: TypeForm): Promise<SaveResult> {
  if (id !== null && !uuid.test(id)) return { ok: false, notFound: true };
  const parsed = parseTypeForm(form);
  if (!parsed.ok) return parsed;
  const known = new Set((await repo.listZones()).map((z) => z.id));
  const input = { ...parsed.input, zoneIds: parsed.input.zoneIds.filter((z) => known.has(z)) };
  if (id === null) return { ok: true, ...(await repo.createType(input)) };
  return (await repo.updateType(id, input)) ? { ok: true, id } : { ok: false, notFound: true };
}

/** P1/P2/P3/P5: create (id = null) or edit a preparation and its exceptions. */
export async function savePreparation(
  repo: CatalogRepository,
  id: string | null,
  form: PreparationForm,
): Promise<SaveResult> {
  if (id !== null && !uuid.test(id)) return { ok: false, notFound: true };
  const parsed = parsePreparationForm(form);
  if (!parsed.ok) return parsed;
  if (!(await repo.getType(parsed.input.procedureTypeId))) {
    return { ok: false, errors: { procedureTypeId: "required" } };
  }
  try {
    if (id === null) return { ok: true, ...(await repo.createPreparation(parsed.input)) };
    return (await repo.updatePreparation(id, parsed.input)) ? { ok: true, id } : { ok: false, notFound: true };
  } catch (error) {
    if (error instanceof DuplicateNameError) return { ok: false, errors: { name: "duplicate" } };
    throw error;
  }
}

/** B1: zones to choose from when creating a type. */
export async function getTypeFormData(repo: CatalogRepository): Promise<{ zones: Zone[] }> {
  return { zones: await repo.listZones() };
}

/** P1/P2: data for a new preparation – the procedure types to choose from and the selected one. */
export async function getNewPreparationData(
  repo: CatalogRepository,
  typeId: string | undefined,
): Promise<{ types: ProcedureType[]; type: ProcedureType } | null> {
  const types = [...(await repo.listTypes())].sort((a, b) => a.sortOrder - b.sortOrder);
  const type = types.find((t) => t.id === typeId) ?? types[0];
  return type ? { types, type } : null;
}

/** P1/P2: procedure types to move a preparation to. */
export async function listTypes(repo: CatalogRepository): Promise<ProcedureType[]> {
  return [...(await repo.listTypes())].sort((a, b) => a.sortOrder - b.sortOrder);
}
