import type { CatalogSettings } from "@/logic/catalog";
import { rangeText, type SettingGroup } from "@/logic/rules/catalog-settings";

type Translate = (key: string, values?: Record<string, string | number>) => string;

/**
 * Readable values for the settings rows (P3): null means nothing is set («заполнить» on a type).
 * `t` is the translator for the «catalog» namespace.
 */
export function describeSettings(t: Translate, s: CatalogSettings): Record<Exclude<SettingGroup, "advice">, string | null> {
  const course = rangeText(s.courseMin, s.courseMax);
  const interval = rangeText(s.intervalMin, s.intervalMax);
  const maintenance = rangeText(s.maintenanceMin, s.maintenanceMax);
  const withUnit = (r: ReturnType<typeof rangeText>, unit: string | null) =>
    r && unit ? t(`value.${unit}`, r) : r?.range ?? null;
  const singleCourse = s.courseMax !== null && s.courseMax <= 1;

  const maintenanceParts = [
    withUnit(maintenance, s.maintenanceUnit),
    s.maintenanceAsNeeded ? t("value.asNeeded") : null,
  ].filter(Boolean);

  return {
    dose: s.doseText ? [s.doseText, s.doseUnit].filter(Boolean).join(" ") : null,
    course: course ? t("value.course", course) : null,
    interval: interval ? withUnit(interval, s.intervalUnit) : singleCourse ? t("value.notNeeded") : null,
    maintenance: maintenanceParts.length > 0 ? maintenanceParts.join(" / ") : null,
    control:
      s.controlAfterDays === null
        ? null
        : s.controlAfterDays === 0
          ? t("value.controlNone")
          : t("value.controlDays", { count: s.controlAfterDays }),
  };
}

export const valueGroups = ["dose", "course", "interval", "maintenance", "control"] as const;
