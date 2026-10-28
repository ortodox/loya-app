import type { Locale } from "@/config/locales";
import type { CourseSummary, Direction } from "./course";
import type { FaceScheme } from "./face-scheme";

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
  /** PP1: the procedure plan belongs to the client. */
  procedurePlan: string | null;
  /** AN3: last time the doctor confirmed «Анамнез без изменений». */
  anamnesisConfirmedAt: IsoDate | null;
  /** VS1/VP2: dates of all the client's visits, past and planned. */
  visitDates: IsoDate[];
  /** DM1: «Косметология», «Дерматология» or both; empty when not set. */
  direction: Direction[];
  /** LE4: the client's treatment courses, for «На лечении» in the list. */
  courses: CourseSummary[];
  /** UH1: «Уход» – home care written by the doctor, and when it last changed. */
  careText: string | null;
  careUpdatedAt: IsoDate | null;
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
  procedurePlan: string | null;
  direction: Direction[];
};

/** R1/DO1/P9: one preparation used in a visit; name and type are copies from the time of the visit. */
export type VisitItem = {
  id: string;
  preparationId: string | null;
  preparationName: string;
  procedureTypeId: string | null;
  /** DO1: free text, e.g. «20+15 ед.». */
  quantity: string | null;
  sortOrder: number;
};

/** LOT1: photo of the preparation stickers (at most 3 per visit). */
export type VisitPhoto = { id: string; storagePath: string; sortOrder: number };

/** VS1: a visit – date, preparations, quantities, sticker photos, notes, post-procedure advice. */
export type Visit = {
  id: string;
  clientId: string;
  visitDate: IsoDate;
  createdAt: string;
  /** R2: internal notes, never shown to the client. */
  notes: string | null;
  /** P5: post-procedure advice, one per line (filled from the catalogue, editable). */
  recommendations: string | null;
  recommendationsLang: Locale | null;
  /** P5: the doctor edited the advice herself – never replace it without asking. */
  recommendationsEdited: boolean;
  /** Z5: points and lines drawn on the face template; null = no scheme. */
  faceScheme: FaceScheme | null;
  items: VisitItem[];
  photos: VisitPhoto[];
  /** Fields of the MVP 1a visit form, kept read-only («Архив»). */
  archive: { homeCareRecommendations: string | null; procedurePlan: string | null };
};

export type VisitItemInput = {
  preparationId: string;
  preparationName: string;
  procedureTypeId: string;
  quantity: string | null;
};

export type VisitInput = {
  visitDate: IsoDate;
  notes: string | null;
  recommendations: string | null;
  recommendationsLang: Locale | null;
  recommendationsEdited: boolean;
  /** Z5: points and lines drawn on the face template; null = no scheme. */
  faceScheme: FaceScheme | null;
  items: VisitItemInput[];
};
