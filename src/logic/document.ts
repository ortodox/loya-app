import type { IsoDate } from "./client";

/** DK1: file types the client sends – photos of results and PDF. */
export const documentTypes = ["application/pdf", "image/jpeg", "image/png", "image/heic", "image/heif", "image/webp"] as const;
export type DocumentType = (typeof documentTypes)[number];

/** DK1/LE8: a file in «Документы и анализы», optionally tied to a treatment course. */
export type ClientDocument = {
  id: string;
  clientId: string;
  courseId: string | null;
  title: string | null;
  documentDate: IsoDate;
  storagePath: string;
  mimeType: DocumentType;
  sizeBytes: number;
  createdAt: string;
};

export type DocumentInput = Omit<ClientDocument, "id" | "clientId" | "createdAt">;

/** UH2: a photo in «Уход». */
export type CarePhoto = { id: string; storagePath: string; sortOrder: number };

/** UH1/UH2: the client's home care. */
export type Care = { text: string | null; updatedAt: IsoDate | null; photos: CarePhoto[] };
