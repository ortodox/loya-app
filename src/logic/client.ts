import type { Locale } from "@/config/locales";

/** ISO calendar date, `YYYY-MM-DD`. */
export type IsoDate = string;

/** A field value in a card section: plain text, or quick choices + free text (AN2). */
export type FieldValue =
  | string
  | { choices?: string[]; text?: string; uncertain?: boolean }
  | null
  | undefined;

export type Client = {
  id: string;
  fullName: string;
  /** «Дата»: date of the first visit / registration. */
  cardDate: IsoDate;
  ageAtRegistration: number | null;
  birthDate: IsoDate | null;
  phone: string | null;
  language: Locale | null;
  /** «Жалобы»: quick choices + free text (filled in a later task, JA1). */
  complaints: FieldValue;
  anamnesis: Record<string, FieldValue>;
  notes: string | null;
  lastVisitDate: IsoDate | null;
  updatedAt: string;
};

/** What the doctor types in the create / edit form (PR1, PR3). */
export type ClientInput = {
  fullName: string;
  cardDate: IsoDate;
  ageAtRegistration: number | null;
  birthDate: IsoDate | null;
  phone: string | null;
  language: Locale;
  notes: string | null;
};
