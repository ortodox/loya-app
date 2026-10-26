/**
 * Photos in private storage (bucket «visit-photos»): sticker photos under <doctor_id>/<visit_id>/<file>,
 * prescription photos (LE3) under <doctor_id>/courses/<course_id>/<file>.
 */
export interface PhotoStorage {
  /** Stores a JPEG in the folder (a visit id, or `courses/<course id>`) and returns its storage path. */
  upload(folder: string, bytes: Uint8Array): Promise<string>;
  remove(paths: string[]): Promise<void>;
  /** Short-lived links for showing thumbnails; keys are storage paths. */
  signedUrls(paths: string[]): Promise<Record<string, string>>;
}
