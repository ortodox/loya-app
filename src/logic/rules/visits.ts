import { isLocale } from "@/logic/locale";
import type { IsoDate, Visit } from "@/logic/client";
import type { Locale } from "@/config/locales";
import { isIsoDate } from "./dates";

export const maxPhotosPerVisit = 3;
export const maxItemsPerVisit = 20;
/** Compressed sticker photos are JPEG, at most ~1600 px and 1.2 MB each. */
export const maxPhotoBytes = 1_258_291;
export const maxPhotoSide = 1600;

/** One preparation row of the visit form: from the catalogue, or typed in by hand. */
export type VisitItemForm = {
  preparationId?: string;
  /** «Добавить вручную»: name + procedure type (needed to fetch the advice). */
  manualName?: string;
  manualTypeId?: string;
  quantity?: string;
};

export type VisitForm = {
  visitDate?: string;
  notes?: string;
  recommendations?: string;
  recommendationsLang?: string;
  /** «1» when the doctor edited the advice herself. */
  recommendationsEdited?: string;
  items?: VisitItemForm[];
};

export type VisitFormError =
  | "dateInvalid"
  | "itemInvalid"
  | "manualNameRequired"
  | "manualTypeRequired"
  | "tooManyItems"
  | "tooManyPhotos"
  | "photoInvalid"
  | "preparationNotFound";
export type VisitInputErrors = Partial<Record<"visitDate" | "items" | "photos", VisitFormError>>;

export type ParsedVisitItem =
  | { kind: "catalog"; preparationId: string; quantity: string | null }
  | { kind: "manual"; name: string; procedureTypeId: string; quantity: string | null };

export type ParsedVisit = {
  visitDate: IsoDate;
  notes: string | null;
  recommendations: string | null;
  recommendationsLang: Locale | null;
  recommendationsEdited: boolean;
  items: ParsedVisitItem[];
};

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Multi-line free text: trailing whitespace removed, blank means empty. */
const freeText = (value: string | undefined, max = 10000) => {
  const text = (value ?? "").replace(/\s+$/, "").slice(0, max);
  return text.trim() ? text : null;
};

/**
 * VS1/R1/DO1/R2: date (today by default), one or more preparations with a free-text quantity,
 * internal notes and post-procedure advice. A manual preparation needs a name and a type.
 */
export function parseVisitForm(
  form: VisitForm,
  today: IsoDate,
): { ok: true; input: ParsedVisit } | { ok: false; errors: VisitInputErrors } {
  const errors: VisitInputErrors = {};
  const visitDate = (form.visitDate ?? "").trim() || today;
  if (!isIsoDate(visitDate)) errors.visitDate = "dateInvalid";

  const raw = form.items ?? [];
  const items: ParsedVisitItem[] = [];
  if (raw.length > maxItemsPerVisit) errors.items = "tooManyItems";
  for (const item of raw) {
    const quantity = (item.quantity ?? "").trim().slice(0, 200) || null;
    const name = (item.manualName ?? "").trim().replace(/\s+/g, " ");
    if (item.preparationId) {
      if (!uuid.test(item.preparationId)) errors.items ??= "itemInvalid";
      else items.push({ kind: "catalog", preparationId: item.preparationId, quantity });
    } else if (name || item.manualTypeId) {
      if (!name) errors.items ??= "manualNameRequired";
      else if (!uuid.test(item.manualTypeId ?? "")) errors.items ??= "manualTypeRequired";
      else items.push({ kind: "manual", name, procedureTypeId: item.manualTypeId!, quantity });
    }
    // A completely empty row is ignored.
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    input: {
      visitDate,
      notes: freeText(form.notes),
      recommendations: freeText(form.recommendations),
      recommendationsLang: isLocale(form.recommendationsLang) ? form.recommendationsLang : null,
      recommendationsEdited: form.recommendationsEdited === "1" && freeText(form.recommendations) !== null,
      items,
    },
  };
}

/** LOT1: at most 3 sticker photos per visit, counting the ones kept and the new ones. */
export function photosFit(existing: number, removed: number, added: number): boolean {
  return existing - removed + added <= maxPhotosPerVisit;
}

/** LOT1: an uploaded photo must be a compressed JPEG of reasonable size. */
export function isAcceptablePhoto(file: { type: string; size: number }): boolean {
  return file.type === "image/jpeg" && file.size > 0 && file.size <= maxPhotoBytes;
}

/** LOT1: target size for compressing a photo on the phone, keeping the aspect ratio. */
export function fitWithin(width: number, height: number, max = maxPhotoSide): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/** VS1: newest visit first; visits on the same day by when they were written, newest first. */
export function sortVisitsNewestFirst<T extends Pick<Visit, "visitDate" | "createdAt">>(
  visits: readonly T[],
): T[] {
  return [...visits].sort(
    (a, b) => b.visitDate.localeCompare(a.visitDate) || b.createdAt.localeCompare(a.createdAt),
  );
}

/** Archive of the MVP 1a visit form: shown read-only when it has content. */
export function hasArchive(visit: Pick<Visit, "archive">): boolean {
  return Boolean(visit.archive.homeCareRecommendations?.trim() || visit.archive.procedurePlan?.trim());
}

/** PO1: catalogue preparations the client has had, from the most recent visit back, each once. */
export function usedPreparationIds(visits: readonly Pick<Visit, "visitDate" | "createdAt" | "items">[]): string[] {
  const ids: string[] = [];
  for (const visit of sortVisitsNewestFirst(visits)) {
    for (const item of visit.items) {
      if (item.preparationId && !ids.includes(item.preparationId)) ids.push(item.preparationId);
    }
  }
  return ids;
}
