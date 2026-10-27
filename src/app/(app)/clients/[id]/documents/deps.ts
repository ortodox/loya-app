import { clientRepository, courseRepository, documentRepository, documentStorage } from "@/data/repositories/server";
import type { DocumentDeps } from "@/logic/usecases/documents";

/** Repositories for «Документы и анализы», bound to the signed-in doctor. */
export async function documentDeps(): Promise<DocumentDeps> {
  const [clients, courses, documents, storage] = await Promise.all([
    clientRepository(),
    courseRepository(),
    documentRepository(),
    documentStorage(),
  ]);
  return { clients, courses, documents, storage };
}
