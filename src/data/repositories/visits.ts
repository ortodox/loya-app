import type { Visit, VisitInput } from "@/logic/client";

/** Visit storage interface; Supabase implementation in ./visits-supabase, faked in tests. */
export interface VisitRepository {
  listByClient(clientId: string): Promise<Visit[]>;
  get(id: string): Promise<Visit | null>;
  create(clientId: string, input: VisitInput): Promise<{ id: string }>;
  /** Updates the visit and replaces its preparation rows. Archive fields are never touched. */
  update(id: string, input: VisitInput): Promise<boolean>;
  delete(id: string): Promise<boolean>;
  addPhoto(visitId: string, storagePath: string, sortOrder: number): Promise<void>;
  removePhotos(visitId: string, photoIds: string[]): Promise<void>;
}
