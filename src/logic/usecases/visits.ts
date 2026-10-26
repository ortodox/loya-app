import type { Locale } from "@/config/locales";
import { emptySettings, type Localized, type ProcedureType } from "@/logic/catalog";
import type { Client, IsoDate, Visit, VisitItemInput } from "@/logic/client";
import { effectivePreparationSettings } from "@/logic/rules/catalog-settings";
import { orderForClient, sortPreparations } from "@/logic/rules/catalog-list";
import { safetyAlerts, type SafetyAlert } from "@/logic/rules/safety-alert";
import {
  isAcceptablePhoto,
  parseVisitForm,
  photosFit,
  anamnesisConfirmation,
  lastCompletedVisit,
  sortVisitsNewestFirst,
  usedPreparationIds,
  type VisitForm,
  type VisitInputErrors,
} from "@/logic/rules/visits";
import { DuplicateNameError, type CatalogRepository } from "@/data/repositories/catalog";
import type { ClientRepository } from "@/data/repositories/clients";
import type { PhotoStorage } from "@/data/repositories/photos";
import type { VisitRepository } from "@/data/repositories/visits";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type VisitDeps = {
  clients: ClientRepository;
  visits: VisitRepository;
  catalog: CatalogRepository;
  photos: PhotoStorage;
};

/** A compressed sticker photo from the phone. */
export type PhotoUpload = { bytes: Uint8Array; type: string; size: number };

export type SaveVisitResult =
  | { ok: true; id: string }
  | { ok: false; errors: VisitInputErrors }
  | { ok: false; notFound: true };

/** H1/VS1: the client's visits, newest first. */
export async function listVisits(repo: VisitRepository, clientId: string): Promise<Visit[]> {
  if (!uuid.test(clientId)) return [];
  return sortVisitsNewestFirst(await repo.listByClient(clientId));
}

/** H1: the client's visits for the card, newest first, with thumbnails of the sticker photos. */
export async function listVisitsForCard(
  deps: Pick<VisitDeps, "visits" | "photos">,
  clientId: string,
): Promise<{ visits: Visit[]; photoUrls: Record<string, string> }> {
  const visits = await listVisits(deps.visits, clientId);
  const paths = visits.flatMap((v) => v.photos.map((p) => p.storagePath));
  return { visits, photoUrls: paths.length > 0 ? await deps.photos.signedUrls(paths) : {} };
}

/** VS1: one visit, only when it belongs to the client in the URL. */
export async function getVisit(repo: VisitRepository, clientId: string, visitId: string): Promise<Visit | null> {
  if (!uuid.test(clientId) || !uuid.test(visitId)) return null;
  const visit = await repo.get(visitId);
  return visit && visit.clientId === clientId ? visit : null;
}

/** A catalogue preparation as offered in the visit form, with the values that apply to it (P3/P5). */
export type PreparationOption = {
  id: string;
  name: string;
  manufacturer: string | null;
  favorite: boolean;
  /** PO1: the client has had this preparation before. */
  usedBefore: boolean;
  procedureTypeId: string;
  /** DO1: standard dose from the catalogue, shown as help text. */
  doseText: string | null;
  doseUnit: string | null;
  advice: Localized | null;
};

export type VisitFormData = {
  client: Pick<Client, "id" | "fullName" | "language">;
  /** P5: language for the advice – the client's language, Russian otherwise. */
  language: Locale;
  /** AL1: allergies and medications, shown next to the advice. */
  alerts: SafetyAlert[];
  preparations: PreparationOption[];
  types: Pick<ProcedureType, "id" | "name" | "advice" | "doseText" | "doseUnit">[];
  visit: Visit | null;
  /** RV1: «Повторить прошлый визит» – the visit whose preparations and quantities are copied. */
  repeatFrom: Visit | null;
  /** AN3: last «Анамнез без изменений ✓». */
  anamnesisConfirmedAt: IsoDate | null;
  /** Thumbnails of the visit's photos, by storage path. */
  photoUrls: Record<string, string>;
};

/** R1/P5/AL1: everything the «Новый визит» / edit form needs. */
export async function getVisitFormData(
  deps: VisitDeps,
  clientId: string,
  visitId: string | null,
  repeat: { today: IsoDate } | null = null,
): Promise<VisitFormData | null> {
  if (!uuid.test(clientId)) return null;
  const client = await deps.clients.get(clientId);
  if (!client) return null;
  const visit = visitId === null ? null : await getVisit(deps.visits, clientId, visitId);
  if (visitId !== null && !visit) return null;

  const [types, preparations, earlier] = await Promise.all([
    deps.catalog.listTypes(),
    deps.catalog.listPreparations(),
    deps.visits.listByClient(clientId),
  ]);
  const typeById = new Map(types.map((t) => [t.id, t]));
  const used = usedPreparationIds(earlier);
  const options: PreparationOption[] = orderForClient(sortPreparations(preparations), used).flatMap((p) => {
    const type = typeById.get(p.procedureTypeId);
    if (!type) return [];
    const { settings } = effectivePreparationSettings(type, p);
    return [
      {
        id: p.id,
        name: p.name,
        manufacturer: p.manufacturer,
        favorite: p.favorite,
        usedBefore: used.includes(p.id),
        procedureTypeId: p.procedureTypeId,
        doseText: settings.doseText,
        doseUnit: settings.doseUnit,
        advice: settings.advice,
      },
    ];
  });

  return {
    client: { id: client.id, fullName: client.fullName, language: client.language },
    language: client.language ?? "ru",
    alerts: safetyAlerts(client.anamnesis),
    preparations: options,
    types: [...types]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((t) => ({ id: t.id, name: t.name, advice: t.advice, doseText: t.doseText, doseUnit: t.doseUnit })),
    visit,
    repeatFrom: visit === null && repeat ? lastCompletedVisit(earlier, repeat.today) : null,
    anamnesisConfirmedAt: client.anamnesisConfirmedAt,
    photoUrls: visit ? await deps.photos.signedUrls(visit.photos.map((p) => p.storagePath)) : {},
  };
}

/**
 * VS1/R1/DO1/LOT1/R2/P5/P9: create (visitId = null) or edit a visit.
 * - Preparations from the catalogue are copied with their name and type as of today (P9).
 * - A preparation added by hand is saved in the catalogue (or the existing one with that name reused).
 * - Up to 3 sticker photos; removed photos are deleted from storage.
 */
export async function saveVisit(
  deps: VisitDeps,
  clientId: string,
  visitId: string | null,
  form: VisitForm,
  photos: { add: PhotoUpload[]; removeIds: string[] },
  today: IsoDate,
): Promise<SaveVisitResult> {
  const client = uuid.test(clientId) ? await deps.clients.get(clientId) : null;
  if (!client) return { ok: false, notFound: true };
  const existing = visitId === null ? null : await getVisit(deps.visits, clientId, visitId);
  if (visitId !== null && !existing) return { ok: false, notFound: true };

  const parsed = parseVisitForm(form, today);
  if (!parsed.ok) return parsed;

  const removed = (existing?.photos ?? []).filter((p) => photos.removeIds.includes(p.id));
  if (!photosFit(existing?.photos.length ?? 0, removed.length, photos.add.length)) {
    return { ok: false, errors: { photos: "tooManyPhotos" } };
  }
  if (!photos.add.every(isAcceptablePhoto)) return { ok: false, errors: { photos: "photoInvalid" } };

  // Validate every row before anything is written.
  const resolved: (VisitItemInput | { manual: { name: string; procedureTypeId: string }; quantity: string | null })[] = [];
  for (const item of parsed.input.items) {
    if (item.kind === "catalog") {
      const preparation = await deps.catalog.getPreparation(item.preparationId);
      if (!preparation) return { ok: false, errors: { items: "preparationNotFound" } };
      resolved.push({
        preparationId: preparation.id,
        preparationName: preparation.name,
        procedureTypeId: preparation.procedureTypeId,
        quantity: item.quantity,
      });
    } else {
      if (!(await deps.catalog.getType(item.procedureTypeId))) return { ok: false, errors: { items: "manualTypeRequired" } };
      resolved.push({ manual: { name: item.name, procedureTypeId: item.procedureTypeId }, quantity: item.quantity });
    }
  }

  const items: VisitItemInput[] = [];
  for (const r of resolved) {
    if (!("manual" in r)) {
      items.push(r);
      continue;
    }
    const id = await addToCatalog(deps.catalog, r.manual.name, r.manual.procedureTypeId);
    items.push({ preparationId: id, preparationName: r.manual.name, procedureTypeId: r.manual.procedureTypeId, quantity: r.quantity });
  }

  const { anamnesisConfirmed, ...visitFields } = parsed.input;
  const input = { ...visitFields, items };
  let id: string;
  if (existing) {
    if (!(await deps.visits.update(existing.id, input))) return { ok: false, notFound: true };
    id = existing.id;
  } else {
    id = (await deps.visits.create(clientId, input)).id;
  }

  if (removed.length > 0) {
    await deps.photos.remove(removed.map((p) => p.storagePath));
    await deps.visits.removePhotos(id, removed.map((p) => p.id));
  }
  const kept = (existing?.photos ?? []).filter((p) => !removed.includes(p));
  let order = Math.max(-1, ...kept.map((p) => p.sortOrder)) + 1;
  for (const photo of photos.add) {
    const path = await deps.photos.upload(id, photo.bytes);
    await deps.visits.addPhoto(id, path, order++);
  }

  // AN3: «Анамнез без изменений ✓» – remember when the anamnesis was last confirmed.
  const confirmed = anamnesisConfirmed ? anamnesisConfirmation(input.visitDate, today, client.anamnesisConfirmedAt) : null;
  if (confirmed) await deps.clients.confirmAnamnesis(clientId, confirmed);
  return { ok: true, id };
}

/** R1: «Добавить вручную» – the preparation is kept in the catalogue for next time. */
async function addToCatalog(catalog: CatalogRepository, name: string, procedureTypeId: string): Promise<string> {
  try {
    return (
      await catalog.createPreparation({ ...emptySettings, procedureTypeId, name, manufacturer: null, favorite: false })
    ).id;
  } catch (error) {
    if (!(error instanceof DuplicateNameError)) throw error;
    const same = (await catalog.listPreparations()).find((p) => p.procedureTypeId === procedureTypeId && p.name === name);
    if (!same) throw error;
    return same.id;
  }
}

/** VS1: delete a visit and its sticker photos (the UI asks for confirmation first). */
export async function deleteVisit(deps: Pick<VisitDeps, "visits" | "photos">, clientId: string, visitId: string): Promise<boolean> {
  const visit = await getVisit(deps.visits, clientId, visitId);
  if (!visit) return false;
  await deps.photos.remove(visit.photos.map((p) => p.storagePath));
  return deps.visits.delete(visitId);
}
