import type { IsoDate } from "@/logic/client";
import { documentTypes, type ClientDocument, type DocumentType } from "@/logic/document";
import { isIsoDate } from "./dates";

/** DK1: at most ~20 MB per file (the bucket refuses larger ones too). */
export const maxDocumentBytes = 20 * 1024 * 1024;

export const isDocumentType = (type: string): type is DocumentType => (documentTypes as readonly string[]).includes(type);

/** DK1: only images and PDF, not empty, not larger than 20 MB. */
export function isAcceptableDocument(file: { type: string; size: number }): boolean {
  return isDocumentType(file.type) && file.size > 0 && file.size <= maxDocumentBytes;
}

/** DK3: a PDF opens in the browser's viewer, an image in full size. */
export function documentKind(type: DocumentType): "pdf" | "image" {
  return type === "application/pdf" ? "pdf" : "image";
}

const extensions: Record<DocumentType, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/webp": "webp",
};

/** DK1: file extension for the storage path. */
export const documentExtension = (type: DocumentType) => extensions[type];

export type DocumentForm = { title?: string; documentDate?: string; courseId?: string; markLabs?: string };
export type DocumentFormError = "dateInvalid" | "fileInvalid";

/** DK1/LE8: optional title, date (today by default), optional course, «Отметить анализы сданными?». */
export function parseDocumentForm(
  form: DocumentForm,
  today: IsoDate,
): { ok: true; title: string | null; documentDate: IsoDate; courseId: string | null; markLabs: boolean } | { ok: false; error: DocumentFormError } {
  const documentDate = (form.documentDate ?? "").trim() || today;
  if (!isIsoDate(documentDate)) return { ok: false, error: "dateInvalid" };
  const title = (form.title ?? "").trim().replace(/\s+/g, " ").slice(0, 200) || null;
  const courseId = (form.courseId ?? "").trim() || null;
  return { ok: true, title, documentDate, courseId, markLabs: courseId !== null && form.markLabs === "1" };
}

/** LE8: «Анализы сданы» from a document – its date, but never in the future. */
export const labDateFromDocument = (documentDate: IsoDate, today: IsoDate): IsoDate => (documentDate < today ? documentDate : today);

/** DK1: newest document first; same day by when it was added. */
export function sortDocuments<T extends Pick<ClientDocument, "documentDate" | "createdAt">>(docs: readonly T[]): T[] {
  return [...docs].sort((a, b) => b.documentDate.localeCompare(a.documentDate) || b.createdAt.localeCompare(a.createdAt));
}

/** LE8: the documents tied to each course («Анализы» in the course). */
export function documentsByCourse<T extends Pick<ClientDocument, "courseId">>(docs: readonly T[]): Record<string, T[]> {
  const result: Record<string, T[]> = {};
  for (const d of docs) if (d.courseId) (result[d.courseId] ??= []).push(d);
  return result;
}

/** UH1: «Обновлено» moves only when the text or the photos actually change. */
export function careChanged(before: string | null, after: string | null, photosAdded: number, photosRemoved: number): boolean {
  return (before ?? "").trim() !== (after ?? "").trim() || photosAdded > 0 || photosRemoved > 0;
}

/** UH2: photos sent in one save (the request size limit); «Уход» can collect more over time. */
export const maxCarePhotosPerSave = 3;
export const maxCarePhotos = 20;
