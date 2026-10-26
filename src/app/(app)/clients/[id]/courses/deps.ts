import { clientRepository, courseRepository, photoStorage } from "@/data/repositories/server";
import type { CourseDeps } from "@/logic/usecases/courses";

/** Repositories for the course pages and actions, bound to the signed-in doctor. */
export async function courseDeps(): Promise<CourseDeps> {
  const [clients, courses, photos] = await Promise.all([clientRepository(), courseRepository(), photoStorage()]);
  return { clients, courses, photos };
}
