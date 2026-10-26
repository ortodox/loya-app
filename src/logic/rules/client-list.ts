import type { IsoDate } from "@/logic/client";

type Dated = { lastVisitDate: IsoDate | null; cardDate: IsoDate };

/** PR2/VS1: the date shown in the list – the last visit when there is one, else the first visit. */
export function lastActivityDate(client: Dated): IsoDate {
  return client.lastVisitDate ?? client.cardDate;
}

/** PR2: newest first, by last activity; ties by most recently edited. */
export function sortNewestFirst<T extends Dated & { updatedAt: string }>(
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

/**
 * VS1/VP2: the last visit that has taken place (today or earlier) and the next planned one
 * (a visit dated after today is an appointment).
 */
export function visitTimeline(dates: readonly IsoDate[], today: IsoDate): { last: IsoDate | null; next: IsoDate | null } {
  const past = dates.filter((d) => d <= today).sort();
  const future = dates.filter((d) => d > today).sort();
  return { last: past.at(-1) ?? null, next: future[0] ?? null };
}

const phoneChars = /^[\d\s+\-().]+$/;

/**
 * PR2/PR7: search by name, or by phone number when only digits (and spaces, +, -, brackets) are typed –
 * «600 123» finds «+48 600-123-456».
 */
export function matchesClient(client: { fullName: string; phone: string | null }, query: string): boolean {
  const digits = query.replace(/\D/g, "");
  if (phoneChars.test(query.trim()) && digits.length >= 3) {
    return (client.phone ?? "").replace(/\D/g, "").includes(digits);
  }
  return matchesName(client.fullName, query);
}

/** PR2: short text under the name – the first non-empty line of the notes. */
export function notesExcerpt(notes: string | null, maxLength = 80): string {
  const line = (notes ?? "").split("\n").map((l) => l.trim()).find(Boolean) ?? "";
  return line.length > maxLength ? `${line.slice(0, maxLength - 1).trimEnd()}…` : line;
}
