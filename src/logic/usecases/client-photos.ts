import type { IsoDate } from "@/logic/client";
import type { ClientPhoto } from "@/logic/client-photo";
import { maxClientPhotosPerSave, parseClientPhotoForm, type ClientPhotoForm } from "@/logic/rules/client-photos";
import { isAcceptablePhoto } from "@/logic/rules/visits";
import type { ClientPhotoRepository } from "@/data/repositories/client-photos";
import type { ClientRepository } from "@/data/repositories/clients";
import type { CourseRepository } from "@/data/repositories/courses";
import type { PhotoStorage } from "@/data/repositories/photos";
import type { PhotoUpload } from "./visits";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ClientPhotoDeps = {
  clients: ClientRepository;
  courses: CourseRepository;
  clientPhotos: ClientPhotoRepository;
  photos: PhotoStorage;
};

export type AddClientPhotosResult =
  | { ok: true }
  | { ok: false; errors: { photos?: "noPhotos" | "tooManyPhotos" | "photoInvalid"; takenOn?: "dateInvalid" } }
  | { ok: false; notFound: true };

/** FK1/FK2: all photos of the client with thumbnails – the card splits them into «Фото клиента» and courses. */
export async function listClientPhotos(
  deps: Pick<ClientPhotoDeps, "clientPhotos" | "photos">,
  clientId: string,
): Promise<{ photos: ClientPhoto[]; urls: Record<string, string> }> {
  if (!uuid.test(clientId)) return { photos: [], urls: {} };
  const photos = await deps.clientPhotos.listByClient(clientId);
  return { photos, urls: photos.length > 0 ? await deps.photos.signedUrls(photos.map((p) => p.storagePath)) : {} };
}

/** FK1/FK3: the add page – the client and, when adding to «Лечение», the course (must be the client's and active). */
export async function getClientPhotoFormData(
  deps: Pick<ClientPhotoDeps, "clients" | "courses">,
  clientId: string,
  courseId: string | null,
): Promise<{ client: { id: string; fullName: string }; course: { id: string; diagnosis: string } | null } | null> {
  if (!uuid.test(clientId)) return null;
  const client = await deps.clients.get(clientId);
  if (!client) return null;
  if (courseId === null) return { client: { id: client.id, fullName: client.fullName }, course: null };
  const course = uuid.test(courseId) ? await deps.courses.get(courseId) : null;
  if (!course || course.clientId !== clientId || course.status !== "active") return null;
  return { client: { id: client.id, fullName: client.fullName }, course: { id: course.id, diagnosis: course.diagnosis } };
}

/**
 * FK1/FK2/FK3: save 1–3 photos (compressed on the phone) with the date taken – to «Фото клиента»,
 * or to an active course of the same client.
 */
export async function addClientPhotos(
  deps: ClientPhotoDeps,
  clientId: string,
  form: ClientPhotoForm,
  uploads: PhotoUpload[],
  today: IsoDate,
): Promise<AddClientPhotosResult> {
  const parsed = parseClientPhotoForm(form, today);
  const data = await getClientPhotoFormData(deps, clientId, parsed.ok ? parsed.courseId : form.courseId?.trim() || null);
  if (!data) return { ok: false, notFound: true };
  if (uploads.length === 0) return { ok: false, errors: { photos: "noPhotos" } };
  if (uploads.length > maxClientPhotosPerSave) return { ok: false, errors: { photos: "tooManyPhotos" } };
  if (!uploads.every(isAcceptablePhoto)) return { ok: false, errors: { photos: "photoInvalid" } };
  if (!parsed.ok) return { ok: false, errors: { takenOn: parsed.error } };

  for (const upload of uploads) {
    const storagePath = await deps.photos.upload(`client-photos/${clientId}`, upload.bytes);
    await deps.clientPhotos.add(clientId, { courseId: data.course?.id ?? null, takenOn: parsed.takenOn, storagePath });
  }
  return { ok: true };
}

/** FK4: delete a photo (e.g. added to the wrong client) – the row and the file. The UI asks first. */
export async function deleteClientPhoto(
  deps: Pick<ClientPhotoDeps, "clientPhotos" | "photos">,
  clientId: string,
  photoId: string,
): Promise<boolean> {
  if (!uuid.test(clientId) || !uuid.test(photoId)) return false;
  const photo = (await deps.clientPhotos.listByClient(clientId)).find((p) => p.id === photoId);
  if (!photo) return false;
  await deps.photos.remove([photo.storagePath]);
  return deps.clientPhotos.remove(clientId, photo.id);
}
