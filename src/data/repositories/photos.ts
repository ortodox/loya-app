/** Sticker photos in private storage (bucket «visit-photos», path <doctor_id>/<visit_id>/<file>). */
export interface PhotoStorage {
  /** Stores a JPEG for the visit and returns its storage path. */
  upload(visitId: string, bytes: Uint8Array): Promise<string>;
  remove(paths: string[]): Promise<void>;
  /** Short-lived links for showing thumbnails; keys are storage paths. */
  signedUrls(paths: string[]): Promise<Record<string, string>>;
}
