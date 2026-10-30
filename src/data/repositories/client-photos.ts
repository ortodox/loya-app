import type { ClientPhoto, ClientPhotoInput } from "@/logic/client-photo";

/** Client photo storage (FK1–FK4); Supabase implementation in ./client-photos-supabase, faked in tests. */
export interface ClientPhotoRepository {
  listByClient(clientId: string): Promise<ClientPhoto[]>;
  add(clientId: string, input: ClientPhotoInput): Promise<void>;
  /** FK4: false when the photo is not this client's. */
  remove(clientId: string, photoId: string): Promise<boolean>;
}
