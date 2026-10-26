import type { Locale } from "@/config/locales";
import type { ProcedureType } from "@/logic/catalog";
import { localized } from "@/logic/rules/catalog-settings";
import { describeSettings } from "../format";

type Translate = (key: string, values?: Record<string, string | number>) => string;

/** Type list and the type's values as grey help text for the preparation form (P3/P5). */
export function preparationFormProps(t: Translate, locale: Locale, types: ProcedureType[], type: ProcedureType) {
  return {
    types: types.map((x) => ({ id: x.id, name: localized(x.name, locale) })),
    inherited: describeSettings(t, type),
    inheritedAdvice: type.advice,
  };
}
