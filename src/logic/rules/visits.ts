import type { IsoDate, Visit, VisitInput } from "@/logic/client";
import { isIsoDate } from "./dates";

export type VisitFormField = "visitDate" | "homeCareRecommendations" | "procedurePlan";
export type VisitForm = Partial<Record<VisitFormField, string>>;
export type VisitInputErrors = Partial<Record<VisitFormField, "dateInvalid">>;

export type ParsedVisitInput =
  | { ok: true; input: VisitInput }
  | { ok: false; errors: VisitInputErrors };

/** Multi-line free text: trailing whitespace removed, blank means empty. */
const freeText = (value: string | undefined) => {
  const text = (value ?? "").replace(/\s+$/, "").slice(0, 10000);
  return text.trim() ? text : null;
};

/** VS1: only the date is needed (today in Warsaw by default); both texts are optional. */
export function parseVisitForm(form: VisitForm, today: IsoDate): ParsedVisitInput {
  const visitDate = (form.visitDate ?? "").trim() || today;
  if (!isIsoDate(visitDate)) return { ok: false, errors: { visitDate: "dateInvalid" } };
  return {
    ok: true,
    input: {
      visitDate,
      homeCareRecommendations: freeText(form.homeCareRecommendations),
      procedurePlan: freeText(form.procedurePlan),
    },
  };
}

/** VS1: newest visit first; visits on the same day by when they were written, newest first. */
export function sortVisitsNewestFirst<T extends Pick<Visit, "visitDate" | "createdAt">>(
  visits: readonly T[],
): T[] {
  return [...visits].sort(
    (a, b) => b.visitDate.localeCompare(a.visitDate) || b.createdAt.localeCompare(a.createdAt),
  );
}
