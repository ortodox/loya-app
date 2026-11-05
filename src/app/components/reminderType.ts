import type { Locale } from "@/config/locales";
import { localized } from "@/logic/rules/catalog-settings";
import type { OpenReminder, ReminderType } from "@/logic/rules/reminders";
import { uniqueTypes } from "@/logic/rules/reminders";

/** N7 ✏️: short names for the standard types (approved 05.11.2026) – «Ботокс», «Биоревитализация», «Пилинг»… */
export const shortTypeCodes = ["BT-01", "BT-02", "BT-03", "BT-04", "BT-05", "BT-06", "BT-07", "BT-08", "BT-09", "BT-10"] as const;

type Translate = (key: string) => string;

/** N7 ✏️: the short name of a standard type, the doctor's own name for her own types, «Процедура» without preparations. */
export function reminderTypeLabel(t: Translate, type: ReminderType | null, locale: Locale): string {
  if (!type) return t("procedure");
  if (type.code && (shortTypeCodes as readonly string[]).includes(type.code)) return t(`short.${type.code}`);
  return localized(type.name, locale) || t("procedure");
}

/** N7 ✏️: «Ботокс, Биоревитализация» – the procedures of the given reminders, each once. */
export function reminderTypesText(t: Translate, reminders: readonly OpenReminder[], locale: Locale): string {
  const labels = uniqueTypes(reminders.flatMap((r) => r.types)).map((x) => reminderTypeLabel(t, x, locale));
  // A visit without preparations is «Процедура» – listed after the named types.
  if (reminders.some((r) => r.types.length === 0)) labels.push(t("procedure"));
  return [...new Set(labels)].join(", ");
}
