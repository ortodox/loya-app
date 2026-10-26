import type { Preparation } from "@/logic/catalog";
import { matchesName } from "./client-list";

/** P1: favourites first, then alphabetically in Russian order (Cyrillic before Latin). */
export function sortPreparations<T extends Pick<Preparation, "favorite" | "name">>(list: readonly T[]): T[] {
  const collator = new Intl.Collator("ru", { sensitivity: "base", numeric: true });
  return [...list].sort((a, b) => Number(b.favorite) - Number(a.favorite) || collator.compare(a.name, b.name));
}

/** P1: search preparations by name or manufacturer, every typed word must match. */
export function matchesPreparation(p: Pick<Preparation, "name" | "manufacturer">, query: string): boolean {
  return matchesName(`${p.name} ${p.manufacturer ?? ""}`, query);
}

/**
 * PO1: preparation order in the visit form – what the client has had before (most recent visit
 * first), then favourites, then the rest; within each group the catalogue order is kept.
 */
export function orderForClient<T extends { id: string }>(sorted: readonly T[], usedBefore: readonly string[]): T[] {
  const rank = new Map(usedBefore.map((id, i) => [id, i]));
  const used = sorted.filter((p) => rank.has(p.id)).sort((a, b) => rank.get(a.id)! - rank.get(b.id)!);
  return [...used, ...sorted.filter((p) => !rank.has(p.id))];
}
