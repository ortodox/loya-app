import type { ClientDocument, DocumentInput } from "@/logic/document";

/** Document rows (DK1/LE8); Supabase implementation in ./documents-supabase, faked in tests. */
export interface DocumentRepository {
  listByClient(clientId: string): Promise<ClientDocument[]>;
  get(id: string): Promise<ClientDocument | null>;
  create(clientId: string, input: DocumentInput): Promise<{ id: string }>;
  delete(id: string): Promise<boolean>;
}

/**
 * Files in the private bucket «client-documents» under <doctor_id>/<client_id>/<file>. Files go
 * straight from the phone to Storage with a one-time signed upload link (they can be 20 MB – too
 * large for a server action).
 */
export interface DocumentStorage {
  /** A path for a new file and a short-lived link the browser uploads it to. */
  createUpload(clientId: string, extension: string): Promise<{ path: string; uploadUrl: string }>;
  /** The file is there and belongs to the signed-in doctor's client folder. */
  exists(path: string): Promise<boolean>;
  remove(paths: string[]): Promise<void>;
  /** DK3: short-lived links for opening the files; keys are storage paths. */
  signedUrls(paths: string[]): Promise<Record<string, string>>;
}
