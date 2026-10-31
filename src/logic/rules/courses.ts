import type { IsoDate } from "@/logic/client";
import {
  directions,
  labUnits,
  type CourseInput,
  type CourseSummary,
  type Direction,
  type LabInterval,
  type LabUnit,
  type TreatmentCourse,
} from "@/logic/course";
import { addDays, addMonths, daysBetween, isIsoDate } from "./dates";

/** DM1: ticked directions, in a fixed order, unknown values dropped. */
export function parseDirection(values: readonly string[] | undefined): Direction[] {
  return directions.filter((d) => (values ?? []).includes(d));
}

/** DM1: a treatment course makes the client a dermatology client (the doctor can untick it later). */
export function withDermatology(direction: readonly Direction[]): Direction[] {
  return parseDirection([...direction, "dermatology"]);
}

export type CourseForm = {
  diagnosis?: string;
  prescription?: string;
  startDate?: string;
  endDate?: string;
  /** «1» when «Контроль анализов» is on. */
  labEnabled?: string;
  /** e.g. «2,5» – decimals with comma or point. */
  labValue?: string;
  labUnit?: string;
  lastLabDate?: string;
};

export type CourseFormError =
  | "diagnosisRequired"
  | "dateInvalid"
  | "endRequired"
  | "endBeforeStart"
  | "labIntervalInvalid";
export type CourseInputErrors = Partial<Record<"diagnosis" | "startDate" | "endDate" | "lab" | "lastLabDate", CourseFormError>>;

const multiline = (v: string | undefined) => ((v ?? "").trim() ? (v ?? "").replace(/\s+$/, "") : null);

/** LE6: «2,5» → 2.5; null when not a positive number of reasonable size. */
export function parseIntervalValue(text: string | undefined): number | null {
  const value = Number((text ?? "").trim().replace(",", "."));
  return Number.isFinite(value) && value > 0 && value <= 365 ? Math.round(value * 100) / 100 : null;
}

/** LE1/LE6: diagnosis, prescription, start (today by default), approximate end, optional lab control. */
export function parseCourseForm(
  form: CourseForm,
  today: IsoDate,
): { ok: true; input: CourseInput } | { ok: false; errors: CourseInputErrors } {
  const errors: CourseInputErrors = {};
  const diagnosis = (form.diagnosis ?? "").trim().replace(/\s+/g, " ").slice(0, 500);
  if (!diagnosis) errors.diagnosis = "diagnosisRequired";

  const startDate = (form.startDate ?? "").trim() || today;
  if (!isIsoDate(startDate)) errors.startDate = "dateInvalid";
  const endDate = (form.endDate ?? "").trim();
  if (!endDate) errors.endDate = "endRequired";
  else if (!isIsoDate(endDate)) errors.endDate = "dateInvalid";
  else if (isIsoDate(startDate) && endDate < startDate) errors.endDate = "endBeforeStart";

  let labInterval: LabInterval | null = null;
  if (form.labEnabled === "1") {
    const value = parseIntervalValue(form.labValue);
    const unit = labUnits.find((u) => u === form.labUnit);
    if (value === null || !unit) errors.lab = "labIntervalInvalid";
    else labInterval = { value, unit };
  }
  const lastLabDate = (form.lastLabDate ?? "").trim() || null;
  if (lastLabDate && !isIsoDate(lastLabDate)) errors.lastLabDate = "dateInvalid";

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    input: {
      diagnosis,
      prescription: multiline(form.prescription),
      startDate,
      endDate,
      labInterval,
      lastLabDate: labInterval ? lastLabDate : null,
    },
  };
}

/**
 * LE6: date + interval. Months are calendar months; a fraction of a month counts as 30 days
 * («каждые 2,5 месяца» from 01.09 → 16.11).
 */
export function addInterval(date: IsoDate, { value, unit }: LabInterval): IsoDate {
  if (unit === "days") return addDays(date, Math.round(value));
  if (unit === "weeks") return addDays(date, Math.round(value * 7));
  const whole = Math.floor(value);
  return addDays(addMonths(date, whole), Math.round((value - whole) * 30));
}

/** LE6: when the next lab tests are due – from the last ones, or from the start of the course. */
export function nextLabDate(course: Pick<TreatmentCourse, "labInterval" | "lastLabDate" | "startDate">): IsoDate | null {
  return course.labInterval ? addInterval(course.lastLabDate ?? course.startDate, course.labInterval) : null;
}

export type CourseProgress = {
  /** Days until the approximate end; 0 on and after the end date. */
  daysLeft: number;
  /** 0…1 for the progress bar. */
  fraction: number;
  /** The end date has passed – «Курс закончился», «Завершить курс» / «Продлить». */
  ended: boolean;
};

/** LE2: «осталось N дней» and the progress bar. */
export function courseProgress(course: Pick<TreatmentCourse, "startDate" | "endDate">, today: IsoDate): CourseProgress {
  const total = Math.max(1, daysBetween(course.startDate, course.endDate));
  const elapsed = Math.min(total, Math.max(0, daysBetween(course.startDate, today)));
  return {
    daysLeft: Math.max(0, daysBetween(today, course.endDate)),
    fraction: elapsed / total,
    ended: today > course.endDate,
  };
}

/** LE5/LE9: active courses (newest start first) and completed ones (most recently finished first). */
export function splitCourses<T extends Pick<TreatmentCourse, "status" | "startDate" | "endDate" | "completedAt">>(
  courses: readonly T[],
): { active: T[]; completed: T[] } {
  const active = courses.filter((c) => c.status === "active").sort((a, b) => b.startDate.localeCompare(a.startDate));
  const completed = courses
    .filter((c) => c.status === "completed")
    .sort((a, b) => (b.completedAt ?? b.endDate).localeCompare(a.completedAt ?? a.endDate));
  return { active, completed };
}

export type TreatmentStatus = { daysLeft: number; ended: boolean };

/**
 * LE4: «🩺 На лечении · N дн.» – the active course that ends first; `ended` when its end date has
 * passed but it is not finished yet («Курс закончился»). Null when the client has no active course.
 */
export function treatmentStatus(courses: readonly CourseSummary[], today: IsoDate): TreatmentStatus | null {
  const active = courses.filter((c) => c.status === "active").sort((a, b) => a.endDate.localeCompare(b.endDate));
  if (active.length === 0) return null;
  const { daysLeft, ended } = courseProgress(active[0], today);
  return { daysLeft, ended };
}

/**
 * DM1: the filter above the client list – one direction, or none (= all clients). Older clients
 * without a direction count as «Косметология» until the doctor sets one (as for «Схема лица»).
 */
export function matchesFilter(client: { direction: readonly Direction[] }, filter: Direction | null): boolean {
  if (filter === null) return true;
  return client.direction.length === 0 ? filter === "cosmetology" : client.direction.includes(filter);
}

/** DM1: one tap in the card on a client without a direction – a known direction, or nothing. */
export function chosenDirection(value: string): Direction | null {
  return parseDirection([value])[0] ?? null;
}

/** DM1: tapping the chosen direction again clears the filter. */
export function toggleFilter(current: Direction | null, tapped: Direction): Direction | null {
  return current === tapped ? null : tapped;
}

export const isLabUnit = (v: string): v is LabUnit => (labUnits as readonly string[]).includes(v);

/** LE3: prescription photos sent in one save (the request size limit); a course can collect more over time. */
export const maxCoursePhotosPerSave = 3;
export const maxCoursePhotos = 30;

/**
 * LE6: a new «Последние анализы» date – empty clears it (the next tests are then counted from the
 * start of the course again); otherwise a real date, not in the future.
 */
export function parseLastLabDate(text: string | undefined, today: IsoDate): { ok: true; date: IsoDate | null } | { ok: false } {
  const value = (text ?? "").trim();
  if (value === "") return { ok: true, date: null };
  return isIsoDate(value) && value <= today ? { ok: true, date: value } : { ok: false };
}
