import { alertFields, type AlertField } from "@/config/kartaTemplate";
import type { Anamnesis } from "@/logic/client";
import { fieldText } from "./anamnesis";

export type SafetyAlert = { field: AlertField; text: string };

/** AL2: «Аллергоанамнез» and «Принимаемые препараты» for the top of the card; empty when not filled. */
export function safetyAlerts(anamnesis: Anamnesis | null): SafetyAlert[] {
  return alertFields
    .map((field) => ({ field, text: fieldText(anamnesis?.[field]) }))
    .filter((alert) => alert.text !== "");
}

/** Words in the allergy field that say nothing about a substance («нет», «?»). */
const notASubstance = new Set([
  "нет", "нету", "ничего", "неизвестно", "немає", "нема", "невідомо", "brak", "nie", "none", "unknown",
  "аллергия", "аллергии", "алергія", "alergia", "allergy", "есть", "был", "была", "было", "при", "после",
]);

const tokens = (text: string) => text.match(/[\p{L}\p{N}]+/gu) ?? [];
const lower = (word: string) => word.toLocaleLowerCase("ru");

export type AdviceConflict = { word: string; line: string };

/**
 * AL1: lines of the post-procedure advice that mention a word from «Аллергоанамнез»
 * (e.g. «SPF», «лидокаин»). Longer words also match their inflected forms («лидокаином»).
 */
export function adviceConflicts(allergies: string, recommendations: string): AdviceConflict[] {
  // Each allergy word once, as the doctor wrote it («SPF»), compared in lower case.
  const allergyWords = new Map<string, string>();
  for (const w of tokens(allergies)) {
    const key = lower(w);
    if (key.length >= 3 && !notASubstance.has(key) && !allergyWords.has(key)) allergyWords.set(key, w);
  }
  const conflicts: AdviceConflict[] = [];
  for (const line of recommendations.split("\n")) {
    const lineWords = tokens(line).map(lower);
    for (const [key, word] of allergyWords) {
      const hit = lineWords.some((w) => w === key || (key.length >= 4 && w.startsWith(key)));
      if (hit) conflicts.push({ word, line: line.trim() });
    }
  }
  return conflicts;
}
