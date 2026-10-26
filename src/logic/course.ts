import type { IsoDate } from "./client";

/** DM1: what the client comes for – aesthetic treatments, skin disease, or both. */
export const directions = ["cosmetology", "dermatology"] as const;
export type Direction = (typeof directions)[number];

/** LE6: how often the lab tests are due, e.g. every 2.5 months. */
export const labUnits = ["days", "weeks", "months"] as const;
export type LabUnit = (typeof labUnits)[number];
export type LabInterval = { value: number; unit: LabUnit };

/** LE3: photo of a prescription (written in another system). */
export type CoursePhoto = { id: string; storagePath: string; createdAt: string };

/** LE1: a treatment course – diagnosis, prescription, start and approximate end. */
export type TreatmentCourse = {
  id: string;
  clientId: string;
  diagnosis: string;
  /** What, how much, which scheme – free text. */
  prescription: string | null;
  startDate: IsoDate;
  /** Approximate end; «Продлить» moves it. */
  endDate: IsoDate;
  labInterval: LabInterval | null;
  /** LE6: «Анализы сданы ✓». */
  lastLabDate: IsoDate | null;
  status: "active" | "completed";
  completedAt: IsoDate | null;
  createdAt: string;
  photos: CoursePhoto[];
};

/** LE4: what the client list needs to know about a client's courses. */
export type CourseSummary = Pick<TreatmentCourse, "status" | "startDate" | "endDate">;

export type CourseInput = {
  diagnosis: string;
  prescription: string | null;
  startDate: IsoDate;
  endDate: IsoDate;
  labInterval: LabInterval | null;
  lastLabDate: IsoDate | null;
};

/** LE2/LE6/LE9: fields changed by the buttons on the card. */
export type CoursePatch = Partial<Pick<TreatmentCourse, "endDate" | "status" | "completedAt" | "lastLabDate">>;
