import type { IsoDate } from "@/logic/client";
import type { Care } from "@/logic/document";
import { careChanged, maxCarePhotos, maxCarePhotosPerSave } from "@/logic/rules/documents";
import { isAcceptablePhoto } from "@/logic/rules/visits";
import type { CareRepository } from "@/data/repositories/care";
import type { ClientRepository } from "@/data/repositories/clients";
import type { PhotoStorage } from "@/data/repositories/photos";
import type { PhotoUpload } from "./visits";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type CareDeps = { clients: ClientRepository; care: CareRepository; photos: PhotoStorage };

export type SaveCareResult =
  | { ok: true }
  | { ok: false; errors: { photos: "tooManyPhotos" | "photoInvalid" } }
  | { ok: false; notFound: true };

/** UH1/UH2: «Уход» with photo thumbnails, for the card and the form. */
export async function getCare(
  deps: CareDeps,
  clientId: string,
): Promise<{ care: Care; photoUrls: Record<string, string> } | null> {
  if (!uuid.test(clientId)) return null;
  const client = await deps.clients.get(clientId);
  if (!client) return null;
  const photos = await deps.care.listPhotos(clientId);
  return {
    care: { text: client.careText, updatedAt: client.careUpdatedAt, photos },
    photoUrls: photos.length > 0 ? await deps.photos.signedUrls(photos.map((p) => p.storagePath)) : {},
  };
}

const multiline = (v: string | undefined) => ((v ?? "").trim() ? (v ?? "").replace(/\s+$/, "").slice(0, 10000) : null);

/**
 * UH1/UH2: save the care text and photos (camera or library, compressed on the phone). «Обновлено»
 * becomes today only when something changed.
 */
export async function saveCare(
  deps: CareDeps,
  clientId: string,
  form: { text?: string },
  photos: { add: PhotoUpload[]; removeIds: string[] },
  today: IsoDate,
): Promise<SaveCareResult> {
  const client = uuid.test(clientId) ? await deps.clients.get(clientId) : null;
  if (!client) return { ok: false, notFound: true };
  const existing = await deps.care.listPhotos(clientId);
  const removed = existing.filter((p) => photos.removeIds.includes(p.id));
  if (photos.add.length > maxCarePhotosPerSave || existing.length - removed.length + photos.add.length > maxCarePhotos) {
    return { ok: false, errors: { photos: "tooManyPhotos" } };
  }
  if (!photos.add.every(isAcceptablePhoto)) return { ok: false, errors: { photos: "photoInvalid" } };

  const text = multiline(form.text);
  if (!careChanged(client.careText, text, photos.add.length, removed.length)) return { ok: true };

  await deps.care.setText(clientId, text, today);
  if (removed.length > 0) {
    await deps.photos.remove(removed.map((p) => p.storagePath));
    await deps.care.removePhotos(clientId, removed.map((p) => p.id));
  }
  let order = Math.max(-1, ...existing.filter((p) => !removed.includes(p)).map((p) => p.sortOrder)) + 1;
  for (const photo of photos.add) {
    const path = await deps.photos.upload(`care/${clientId}`, photo.bytes);
    await deps.care.addPhoto(clientId, path, order++);
  }
  return { ok: true };
}
