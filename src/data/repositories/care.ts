import type { IsoDate } from "@/logic/client";
import type { CarePhoto } from "@/logic/document";

/** «Уход» storage (UH1/UH2); Supabase implementation in ./care-supabase, faked in tests. */
export interface CareRepository {
  listPhotos(clientId: string): Promise<CarePhoto[]>;
  /** UH1: the text and «Обновлено». */
  setText(clientId: string, text: string | null, updatedAt: IsoDate): Promise<boolean>;
  addPhoto(clientId: string, storagePath: string, sortOrder: number): Promise<void>;
  removePhotos(clientId: string, photoIds: string[]): Promise<void>;
}
