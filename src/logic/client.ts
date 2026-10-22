import type { Locale } from "@/config/locales";

/** ISO calendar date, `YYYY-MM-DD`. */
export type IsoDate = string;

/**
 * A field in clients.anamnesis: quick choice keys (from src/config/kartaTemplate.ts) + free text.
 * Plain strings are accepted for robustness; free text may contain «?» (AN2).
 */
export type FieldValue = string | { choices?: string[]; text?: string } | null | undefined;

/** clients.anamnesis: flat field keys from the template (complaints, health, skin, aging, procedures). */
export type Anamnesis = Record<string, FieldValue>;

export type Client = {
  id: string;
  fullName: string;
  /** «Дата»: date of the first visit / registration. */
  cardDate: IsoDate;
  ageAtRegistration: number | null;
  birthDate: IsoDate | null;
  phone: string | null;
  email: string | null;
  /** ISO 3166-1 alpha-2, e.g. `PL` (PR1, PR5). */
  residenceCountry: string | null;
  residenceCity: string | null;
  language: Locale | null;
  anamnesis: Anamnesis;
  notes: string | null;
  lastVisitDate: IsoDate | null;
  updatedAt: string;
};

/** What the doctor types in the create / edit form (PR1, PR3, JA1, AN1…). */
export type ClientInput = {
  fullName: string;
  cardDate: IsoDate;
  ageAtRegistration: number | null;
  birthDate: IsoDate | null;
  phone: string | null;
  email: string | null;
  residenceCountry: string | null;
  residenceCity: string | null;
  language: Locale;
  anamnesis: Anamnesis;
  notes: string | null;
};
