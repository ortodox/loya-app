import { careRepository, clientRepository, photoStorage } from "@/data/repositories/server";
import type { CareDeps } from "@/logic/usecases/care";

/** Repositories for «Уход», bound to the signed-in doctor. */
export async function careDeps(): Promise<CareDeps> {
  const [clients, care, photos] = await Promise.all([clientRepository(), careRepository(), photoStorage()]);
  return { clients, care, photos };
}
