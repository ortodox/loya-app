import type { Locale } from "@/config/locales";
import { localized } from "@/logic/rules/catalog-settings";
import type { VisitFormData } from "@/logic/usecases/visits";
import { mergeRecommendations } from "@/logic/rules/recommendations";
import type { FormOption, FormType, ItemState, VisitFormInitial } from "./VisitForm";

const dose = (text: string | null, unit: string | null) => (text ? [text, unit].filter(Boolean).join(" ") : null);

/** Server-side: catalogue names in the UI language and the form's starting values. */
export function visitFormProps(data: VisitFormData, locale: Locale, today: string) {
  const typeName = new Map(data.types.map((t) => [t.id, localized(t.name, locale)]));
  const options: FormOption[] = data.preparations.map((p) => ({
    id: p.id,
    name: p.name,
    manufacturer: p.manufacturer,
    favorite: p.favorite,
    usedBefore: p.usedBefore,
    typeName: typeName.get(p.procedureTypeId) ?? "",
    procedureTypeId: p.procedureTypeId,
    doseHint: dose(p.doseText, p.doseUnit),
    advice: p.advice,
  }));
  const types: FormType[] = data.types.map((t) => ({
    id: t.id,
    name: typeName.get(t.id)!,
    doseHint: dose(t.doseText, t.doseUnit),
    advice: t.advice,
  }));
  const known = new Set(options.map((o) => o.id));
  const visit = data.visit;
  // RV1: a repeated visit copies preparations and quantities; date, photos and notes start fresh.
  const source = visit ?? data.repeatFrom;
  const rows = (source?.items ?? [])
    .filter((i) => visit || (i.preparationId && known.has(i.preparationId)) || i.procedureTypeId)
    .map((i): ItemState => {
      const key = visit ? i.id : crypto.randomUUID();
      // Rows whose preparation is no longer in the catalogue stay as named rows of their type.
      return i.preparationId && known.has(i.preparationId)
        ? { key, preparationId: i.preparationId, manualName: null, manualTypeId: null, quantity: i.quantity ?? "" }
        : { key, preparationId: null, manualName: i.preparationName, manualTypeId: i.procedureTypeId, quantity: i.quantity ?? "" };
    });
  // P5: a repeated visit gets the advice fresh from the catalogue.
  const optionAdvice = new Map(options.map((o) => [o.id, o.advice]));
  const typeAdvice = new Map(types.map((t) => [t.id, t.advice]));
  const freshAdvice = () =>
    mergeRecommendations(
      rows.map((r) => (r.preparationId ? optionAdvice.get(r.preparationId) ?? null : typeAdvice.get(r.manualTypeId ?? "") ?? null)),
      data.language,
    );
  const initial: VisitFormInitial = {
    visitDate: visit?.visitDate ?? today,
    notes: visit?.notes ?? "",
    recommendations: visit ? visit.recommendations ?? "" : freshAdvice(),
    recommendationsEdited: visit?.recommendationsEdited ?? false,
    anamnesisConfirmed: false,
    // Z5/RV1: a repeated visit starts from the last visit's scheme (on its own template) – not for
    // clients marked only «Дерматология», who have no «Схема лица».
    faceScheme: visit ? visit.faceScheme : data.showFaceScheme ? data.repeatFrom?.faceScheme ?? null : null,
    items: rows,
    photos: (visit?.photos ?? []).map((p) => ({ id: p.id, url: data.photoUrls[p.storagePath] ?? null })),
  };
  return {
    options,
    types,
    initial,
    language: data.language,
    alerts: data.alerts,
    anamnesisConfirmedAt: data.anamnesisConfirmedAt,
    showFaceScheme: data.showFaceScheme,
    repeatedFrom: visit ? null : data.repeatFrom?.visitDate ?? null,
  };
}
