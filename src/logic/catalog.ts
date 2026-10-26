import type { Locale } from "@/config/locales";

/** Text in the four UI languages; Russian is the original. */
export type Localized = Partial<Record<Locale, string>>;

export type IntervalUnit = "days" | "weeks" | "months";
export const intervalUnits: readonly IntervalUnit[] = ["days", "weeks", "months"];

export type ZoneGroup = "upper" | "middle" | "lower" | "body" | "other";
export const zoneGroups: readonly ZoneGroup[] = ["upper", "middle", "lower", "body", "other"];

/**
 * Values set per procedure type and inherited by its preparations (P3, P5).
 * On a type, null means «not filled in» (заполнить); on a preparation, null means «inherit».
 */
export type CatalogSettings = {
  doseText: string | null;
  doseUnit: string | null;
  courseMin: number | null;
  courseMax: number | null;
  intervalMin: number | null;
  intervalMax: number | null;
  intervalUnit: IntervalUnit | null;
  maintenanceMin: number | null;
  maintenanceMax: number | null;
  maintenanceUnit: IntervalUnit | null;
  /** «по показаниям». */
  maintenanceAsNeeded: boolean | null;
  /** Follow-up visit after N days; 0 = no follow-up visit. */
  controlAfterDays: number | null;
  /** Post-procedure advice, one recommendation per line (S2). */
  advice: Localized | null;
  /** Languages whose advice is a translation that the doctor has not checked yet. */
  adviceReview: Locale[] | null;
};

export type Zone = {
  id: string;
  code: string | null;
  name: Localized;
  group: ZoneGroup;
  sortOrder: number;
};

export type ProcedureType = CatalogSettings & {
  id: string;
  code: string | null;
  name: Localized;
  sortOrder: number;
  zoneIds: string[];
};

export type Preparation = CatalogSettings & {
  id: string;
  procedureTypeId: string;
  name: string;
  manufacturer: string | null;
  favorite: boolean;
};

export type ProcedureTypeInput = CatalogSettings & { name: Localized; zoneIds: string[] };
export type PreparationInput = CatalogSettings & {
  procedureTypeId: string;
  name: string;
  manufacturer: string | null;
  favorite: boolean;
};

export const emptySettings: CatalogSettings = {
  doseText: null,
  doseUnit: null,
  courseMin: null,
  courseMax: null,
  intervalMin: null,
  intervalMax: null,
  intervalUnit: null,
  maintenanceMin: null,
  maintenanceMax: null,
  maintenanceUnit: null,
  maintenanceAsNeeded: null,
  controlAfterDays: null,
  advice: null,
  adviceReview: null,
};
