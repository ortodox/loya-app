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

/**
 * P5: what to do with the advice field when the preparations change. Text the doctor has edited
 * herself is never overwritten silently – then we ask «Обновить рекомендации?».
 */
export function recommendationUpdate(current: string, lastSuggested: string, nextSuggested: string): RecommendationUpdate {
  const norm = (s: string) => s.trim().replace(/\s+\n/g, "\n");
  if (norm(current) === norm(nextSuggested)) return "keep";
  if (norm(current) === "" || norm(current) === norm(lastSuggested)) return "replace";
  return "ask";
}
