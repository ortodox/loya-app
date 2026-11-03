import type { IsoDate } from "@/logic/client";

/** EX1: the two private Storage buckets whose files are copied into the archive. */
export type ArchiveBucket = "visit-photos" | "client-documents";

/** EX1: «LOA arkiv 2026-11-01» – the folder that holds one backup. */
export function archiveFolderName(today: IsoDate): string {
  return `LOA arkiv ${today}`;
}

/** EX1: one page per client, by id (names can repeat and contain any characters). */
export function clientPagePath(clientId: string): string {
  return `klienter/${clientId}.html`;
}

/**
 * EX1: where a stored file lies in the archive – «filer/<bucket>/<path without the doctor id>».
 * Paths stay unique; anything that could leave the folder («..», empty parts) is removed.
 */
export function archiveFilePath(bucket: ArchiveBucket, storagePath: string): string {
  const parts = storagePath
    .split("/")
    .slice(1)
    .filter((p) => p !== "" && p !== "." && p !== "..")
    .map((p) => p.replace(/[^\p{L}\p{N}._-]/gu, "_"));
  return ["filer", bucket, ...parts].join("/");
}

/** EX1: the same path seen from a client page («klienter/…»), one folder down. */
export function fromClientPage(archivePath: string): string {
  return `../${archivePath}`;
}

/** EX1: clients A–Я as in a paper index (Russian order, case-insensitive). */
export function sortByName<T extends { fullName: string }>(clients: readonly T[]): T[] {
  return [...clients].sort((a, b) => a.fullName.localeCompare(b.fullName, "ru", { sensitivity: "base" }));
}

/** EX1: the first letter for the А–Я jump list; «#» when it is not a letter. */
export function indexLetter(fullName: string): string {
  const first = fullName.trim().charAt(0).toLocaleUpperCase("ru");
  return /\p{L}/u.test(first) ? first : "#";
}
