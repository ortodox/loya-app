import type { Client, IsoDate } from "@/logic/client";

/** PR2: the date shown in the list – the last visit, or the registration date. */
export function lastActivityDate(client: Pick<Client, "lastVisitDate" | "cardDate">): IsoDate {
  if (client.lastVisitDate && client.lastVisitDate > client.cardDate) return client.lastVisitDate;
  return client.cardDate;
}

/** PR2: newest first, by last activity; ties by most recently edited. */
export function sortNewestFirst<T extends Pick<Client, "lastVisitDate" | "cardDate" | "updatedAt">>(
  clients: readonly T[],
): T[] {
  return [...clients].sort((a, b) => {
    const byDate = lastActivityDate(b).localeCompare(lastActivityDate(a));
    return byDate !== 0 ? byDate : b.updatedAt.localeCompare(a.updatedAt);
  });
}

function normalize(text: string): string {
  return text.toLocaleLowerCase("ru").replaceAll("ё", "е").replace(/\s+/g, " ").trim();
}

/** PR2: search by name, case-insensitive, «ё» = «е», every typed word must match. */
export function matchesName(fullName: string, query: string): boolean {
  const words = normalize(query).split(" ").filter(Boolean);
  const name = normalize(fullName);
  return words.every((w) => name.includes(w));
}

/** PR2: short text under the name – the first non-empty line of the notes. */
export function notesExcerpt(notes: string | null, maxLength = 80): string {
  const line = (notes ?? "").split("\n").map((l) => l.trim()).find(Boolean) ?? "";
  return line.length > maxLength ? `${line.slice(0, maxLength - 1).trimEnd()}…` : line;
}
