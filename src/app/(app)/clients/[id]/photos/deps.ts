import { clientPhotoRepository, clientRepository, courseRepository, photoStorage } from "@/data/repositories/server";
import type { ClientPhotoDeps } from "@/logic/usecases/client-photos";

/** Repositories for client photos, bound to the signed-in doctor. */
export async function clientPhotoDeps(): Promise<ClientPhotoDeps> {
  const [clients, courses, clientPhotos, photos] = await Promise.all([clientRepository(), courseRepository(), clientPhotoRepository(), photoStorage()]);
  return { clients, courses, clientPhotos, photos };
}
