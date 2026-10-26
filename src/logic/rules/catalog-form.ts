import { locales, type Locale } from "@/config/locales";
import {
  emptySettings,
  intervalUnits,
  type CatalogSettings,
  type IntervalUnit,
  type Localized,
  type PreparationInput,
  type ProcedureTypeInput,
} from "@/logic/catalog";

export const settingsFormFields = [
  "doseText",
  "doseUnit",
  "courseMin",
  "courseMax",
  "intervalMin",
  "intervalMax",
  "intervalUnit",
  "maintenanceMin",
  "maintenanceMax",
  "maintenanceUnit",
  "maintenanceAsNeeded",
  "controlMode",
  "controlDays",
] as const;
export type SettingsFormField = (typeof settingsFormFields)[number];

/** «–» empty/inherit, «none» no follow-up visit, «days» follow-up after N days. */
export type ControlMode = "" | "none" | "days";

/** Raw values from the settings part of the type and preparation forms. */
export type SettingsForm = Partial<Record<SettingsFormField, string>> & {
  advice?: Localized;
  /** Languages ticked as «требует проверки». */
  adviceReview?: string[];
};

export type CatalogFormError = "required" | "number" | "range" | "unitRequired" | "duplicate";
export type CatalogFormErrors = Partial<Record<string, CatalogFormError>>;

type Parsed<T> = { ok: true; input: T } | { ok: false; errors: CatalogFormErrors };

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const text = (v: string | undefined) => (v ?? "").trim() || null;
const unit = (v: string | undefined): IntervalUnit | null =>
  (intervalUnits as readonly string[]).includes(v ?? "") ? (v as IntervalUnit) : null;

function count(v: string | undefined, max = 999): number | null | "invalid" {
  const s = (v ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isInteger(n) && n >= 1 && n <= max ? n : "invalid";
}

/** min/max pair: one value alone means «exactly that»; min must not exceed max. */
function range(
  form: SettingsForm,
  minField: SettingsFormField,
  maxField: SettingsFormField,
  errors: CatalogFormErrors,
): [number | null, number | null] {
  const min = count(form[minField]);
  const max = count(form[maxField]);
  if (min === "invalid") errors[minField] = "number";
  if (max === "invalid") errors[maxField] = "number";
  if (min === "invalid" || max === "invalid") return [null, null];
  const lo = min ?? max;
  const hi = max ?? min;
  if (lo !== null && hi !== null && lo > hi) errors[maxField] = "range";
  return [lo, hi];
}

/** S2: advice per language, one recommendation per line; null when every language is empty. */
export function parseAdvice(
  advice: Localized | undefined,
  review: string[] | undefined,
): Pick<CatalogSettings, "advice" | "adviceReview"> {
  const result: Localized = {};
  for (const l of locales) {
    const lines = (advice?.[l] ?? "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length > 0) result[l] = lines.join("\n");
  }
  if (Object.keys(result).length === 0) return { advice: null, adviceReview: null };
  const flagged = locales.filter((l) => review?.includes(l) && result[l]) as Locale[];
  return { advice: result, adviceReview: flagged.length > 0 ? flagged : null };
}

/**
 * P3/P5: dose, course, intervals, follow-up and advice. Every field is optional – on a type an
 * empty field means «заполнить», on a preparation it means «inherit from the type».
 */
export function parseSettingsForm(form: SettingsForm): Parsed<CatalogSettings> {
  const errors: CatalogFormErrors = {};
  const [courseMin, courseMax] = range(form, "courseMin", "courseMax", errors);
  const [intervalMin, intervalMax] = range(form, "intervalMin", "intervalMax", errors);
  const [maintenanceMin, maintenanceMax] = range(form, "maintenanceMin", "maintenanceMax", errors);
  const intervalUnit = intervalMin === null ? null : unit(form.intervalUnit);
  const maintenanceUnit = maintenanceMin === null ? null : unit(form.maintenanceUnit);
  if (intervalMin !== null && !intervalUnit) errors.intervalUnit = "unitRequired";
  if (maintenanceMin !== null && !maintenanceUnit) errors.maintenanceUnit = "unitRequired";

  let controlAfterDays: number | null = null;
  if (form.controlMode === "none") controlAfterDays = 0;
  if (form.controlMode === "days") {
    const days = count(form.controlDays, 365);
    if (days === null) errors.controlDays = "required";
    else if (days === "invalid") errors.controlDays = "number";
    else controlAfterDays = days;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    input: {
      ...emptySettings,
      doseText: text(form.doseText),
      doseUnit: text(form.doseUnit),
      courseMin,
      courseMax,
      intervalMin,
      intervalMax,
      intervalUnit,
      maintenanceMin,
      maintenanceMax,
      maintenanceUnit,
      maintenanceAsNeeded: form.maintenanceAsNeeded === "on" ? true : null,
      controlAfterDays,
      ...parseAdvice(form.advice, form.adviceReview),
    },
  };
}

export type TypeForm = SettingsForm & { name?: Localized; zoneIds?: string[] };

/** B1: a procedure type needs a Russian name; names in the other languages are optional. */
export function parseTypeForm(form: TypeForm): Parsed<ProcedureTypeInput> {
  const settings = parseSettingsForm(form);
  const errors: CatalogFormErrors = settings.ok ? {} : { ...settings.errors };
  const name: Localized = {};
  for (const l of locales) {
    const value = (form.name?.[l] ?? "").trim().replace(/\s+/g, " ");
    if (value) name[l] = value;
  }
  if (!name.ru) errors.nameRu = "required";
  if (!settings.ok || Object.keys(errors).length > 0) return { ok: false, errors };
  const zoneIds = [...new Set((form.zoneIds ?? []).filter((id) => uuid.test(id)))];
  return { ok: true, input: { ...settings.input, name, zoneIds } };
}

export type PreparationForm = SettingsForm & {
  name?: string;
  manufacturer?: string;
  favorite?: string;
  procedureTypeId?: string;
};

/** P1/P2: a preparation needs a name and a procedure type; everything else is optional. */
export function parsePreparationForm(form: PreparationForm): Parsed<PreparationInput> {
  const settings = parseSettingsForm(form);
  const errors: CatalogFormErrors = settings.ok ? {} : { ...settings.errors };
  const name = (form.name ?? "").trim().replace(/\s+/g, " ");
  if (!name) errors.name = "required";
  if (!uuid.test(form.procedureTypeId ?? "")) errors.procedureTypeId = "required";
  if (!settings.ok || Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    input: {
      ...settings.input,
      procedureTypeId: form.procedureTypeId!,
      name,
      manufacturer: text(form.manufacturer),
      favorite: form.favorite === "on",
    },
  };
}

/** Form values for editing existing settings (the reverse of parseSettingsForm). */
export function settingsToForm(s: CatalogSettings): SettingsForm {
  const str = (v: number | string | null) => (v === null ? "" : String(v));
  return {
    doseText: s.doseText ?? "",
    doseUnit: s.doseUnit ?? "",
    courseMin: str(s.courseMin),
    courseMax: str(s.courseMax),
    intervalMin: str(s.intervalMin),
    intervalMax: str(s.intervalMax),
    intervalUnit: s.intervalUnit ?? "",
    maintenanceMin: str(s.maintenanceMin),
    maintenanceMax: str(s.maintenanceMax),
    maintenanceUnit: s.maintenanceUnit ?? "",
    maintenanceAsNeeded: s.maintenanceAsNeeded ? "on" : "",
    controlMode: s.controlAfterDays === null ? "" : s.controlAfterDays === 0 ? "none" : "days",
    controlDays: s.controlAfterDays ? String(s.controlAfterDays) : "",
    advice: s.advice ?? {},
    adviceReview: s.adviceReview ?? [],
  };
}
