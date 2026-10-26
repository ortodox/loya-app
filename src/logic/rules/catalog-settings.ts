import { locales, type Locale } from "@/config/locales";
import type { CatalogSettings, Localized } from "@/logic/catalog";

/** Settings that belong together are inherited or overridden as a whole. */
export const settingGroups = {
  dose: ["doseText", "doseUnit"],
  course: ["courseMin", "courseMax"],
  interval: ["intervalMin", "intervalMax", "intervalUnit"],
  maintenance: ["maintenanceMin", "maintenanceMax", "maintenanceUnit", "maintenanceAsNeeded"],
  control: ["controlAfterDays"],
  advice: ["advice", "adviceReview"],
} as const satisfies Record<string, readonly (keyof CatalogSettings)[]>;

export type SettingGroup = keyof typeof settingGroups;
export const settingGroupKeys = Object.keys(settingGroups) as SettingGroup[];

export type SettingSource = "type" | "preparation";

export type EffectiveSettings = {
  settings: CatalogSettings;
  /** Where each group comes from: the procedure type, or the preparation's own value (exception). */
  source: Record<SettingGroup, SettingSource>;
};

export function hasAdvice(advice: Localized | null | undefined): boolean {
  return Boolean(advice && locales.some((l) => (advice[l] ?? "").trim() !== ""));
}

/** True when the preparation sets anything in the group (a null/empty value means «inherit»). */
export function overridesGroup(preparation: CatalogSettings, group: SettingGroup): boolean {
  if (group === "advice") return hasAdvice(preparation.advice);
  return settingGroups[group].some((field) => preparation[field] !== null && preparation[field] !== "");
}

/**
 * P3/P5: the values that apply to a preparation – the procedure type's values, with the
 * preparation's own values (exceptions) winning group by group. An empty field inherits.
 */
export function effectivePreparationSettings(
  type: CatalogSettings,
  preparation: CatalogSettings,
): EffectiveSettings {
  const settings = { ...type };
  const source = {} as Record<SettingGroup, SettingSource>;
  for (const group of settingGroupKeys) {
    const own = overridesGroup(preparation, group);
    source[group] = own ? "preparation" : "type";
    if (own) {
      for (const field of settingGroups[group]) {
        (settings as Record<string, unknown>)[field] = preparation[field];
      }
    }
  }
  return { settings, source };
}

export type MissingItem = SettingGroup | "zones";

/**
 * B1: what is still «заполнить» – groups without a value. An interval is only needed when the
 * course has more than one procedure; «по показаниям» counts as a maintenance value.
 */
export function missingSettings(settings: CatalogSettings, zoneCount?: number): MissingItem[] {
  const missing: MissingItem[] = [];
  if (zoneCount === 0) missing.push("zones");
  if (!settings.doseText?.trim()) missing.push("dose");
  if (settings.courseMin === null) missing.push("course");
  const needsInterval = settings.courseMax === null || settings.courseMax > 1;
  if (settings.intervalMin === null && needsInterval) missing.push("interval");
  if (settings.maintenanceMin === null && !settings.maintenanceAsNeeded) missing.push("maintenance");
  if (settings.controlAfterDays === null) missing.push("control");
  if (!(settings.advice?.ru ?? "").trim()) missing.push("advice");
  return missing;
}

/** Localized text in the UI language, falling back to Russian (the original). */
export function localized(text: Localized | null | undefined, locale: Locale): string {
  return (text?.[locale] ?? "").trim() || (text?.ru ?? "").trim();
}

/** S2: advice lines for one language; empty when that language has no text. */
export function adviceLines(advice: Localized | null, locale: Locale): string[] {
  return (advice?.[locale] ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function needsReview(settings: CatalogSettings, locale: Locale): boolean {
  return Boolean(settings.adviceReview?.includes(locale) && (settings.advice?.[locale] ?? "").trim());
}

/** «3–5», or «4» when min and max are equal; null when not set. `count` is used for plurals. */
export function rangeText(min: number | null, max: number | null): { range: string; count: number } | null {
  if (min === null && max === null) return null;
  const lo = min ?? max!;
  const hi = max ?? min!;
  return { range: lo === hi ? String(lo) : `${lo}–${hi}`, count: hi };
}
