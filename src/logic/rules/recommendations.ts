import type { Locale } from "@/config/locales";
import type { Localized } from "@/logic/catalog";
import { adviceLines } from "./catalog-settings";

/**
 * P5/S2: post-procedure advice for a visit – the advice of every chosen preparation (already merged
 * with its type by effectivePreparationSettings), in the client's language with Russian as the
 * fallback, without repeating the same line.
 */
export function mergeRecommendations(advices: readonly (Localized | null)[], language: Locale): string {
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const advice of advices) {
    const own = adviceLines(advice, language);
    for (const line of own.length > 0 ? own : adviceLines(advice, "ru")) {
      const key = line.toLocaleLowerCase("ru").replace(/[\s.]+$/g, "").replace(/\s+/g, " ");
      if (seen.has(key)) continue;
      seen.add(key);
      lines.push(line);
    }
  }
  return lines.join("\n");
}

export type RecommendationUpdate = "keep" | "replace" | "ask";

const norm = (s: string) => s.trim().replace(/[ \t]+\n/g, "\n");

/**
 * P5: what to do with the advice field when the preparations change. Text the doctor has edited
 * herself (recommendations_edited) is never overwritten silently – then we ask «Обновить рекомендации?».
 */
export function recommendationUpdate(current: string, nextSuggested: string, edited: boolean): RecommendationUpdate {
  if (norm(current) === norm(nextSuggested)) return "keep";
  if (!edited || norm(current) === "") return "replace";
  return "ask";
}

/** P5: the doctor has edited the advice when it is no longer what the catalogue suggested. */
export function differsFromSuggestion(current: string, suggested: string): boolean {
  return norm(current) !== "" && norm(current) !== norm(suggested);
}

/**
 * P5: whether stored advice counts as edited by the doctor. Visits saved before the flag existed
 * (null) count as edited when they have advice – e.g. home-care advice copied from MVP 1a.
 */
export function storedAsEdited(flag: boolean | null, recommendations: string | null): boolean {
  return flag ?? (recommendations ?? "").trim() !== "";
}

/** P5: number of advice points (non-empty lines), for the one-line summary «N пунктов». */
export function countRecommendations(text: string | null): number {
  return (text ?? "").split("\n").filter((line) => line.trim() !== "").length;
}
