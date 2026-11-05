import type { Locale } from "@/config/locales";
import { localized } from "@/logic/rules/catalog-settings";
import { botoxTypeCode } from "@/logic/rules/botox";
import type { OpenReminder, ReminderType } from "@/logic/rules/reminders";
import { uniqueTypes } from "@/logic/rules/reminders";

type Translate = (key: "botox" | "procedure") => string;

/** N7 ✏️: «Ботокс» (Loya's word for BT-01), otherwise the type's name; «Процедура» when the visit had no preparations. */
export function reminderTypeLabel(t: Translate, type: ReminderType | null, locale: Locale): string {
  if (!type) return t("procedure");
  return type.code === botoxTypeCode ? t("botox") : localized(type.name, locale) || t("procedure");
}

/** N7 ✏️: «Ботокс, Биоревитализация / ремоделирование» – the types of the reminders that have come. */
export function reminderTypesText(t: Translate, reminders: readonly OpenReminder[], locale: Locale): string {
  const labels = uniqueTypes(reminders.flatMap((r) => r.types)).map((x) => reminderTypeLabel(t, x, locale));
  // A visit without preparations is «Процедура» – listed after the named types.
  if (reminders.some((r) => r.types.length === 0)) labels.push(t("procedure"));
  return [...new Set(labels)].join(", ");
}
