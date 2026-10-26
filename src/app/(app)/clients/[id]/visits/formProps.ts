import type { Locale } from "@/config/locales";
import { localized } from "@/logic/rules/catalog-settings";
import type { VisitFormData } from "@/logic/usecases/visits";
import type { FormOption, FormType, VisitFormInitial } from "./VisitForm";

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
  const initial: VisitFormInitial = {
    visitDate: visit?.visitDate ?? today,
    notes: visit?.notes ?? "",
    recommendations: visit?.recommendations ?? "",
    recommendationsEdited: visit?.recommendationsEdited ?? false,
    // Rows whose preparation is no longer in the catalogue stay as named rows of their type.
    items: (visit?.items ?? []).map((i) =>
      i.preparationId && known.has(i.preparationId)
        ? { key: i.id, preparationId: i.preparationId, manualName: null, manualTypeId: null, quantity: i.quantity ?? "" }
        : { key: i.id, preparationId: null, manualName: i.preparationName, manualTypeId: i.procedureTypeId, quantity: i.quantity ?? "" },
    ),
    photos: (visit?.photos ?? []).map((p) => ({ id: p.id, url: data.photoUrls[p.storagePath] ?? null })),
  };
  return { options, types, initial, language: data.language, alerts: data.alerts };
}
