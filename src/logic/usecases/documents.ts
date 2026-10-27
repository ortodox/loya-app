import type { IsoDate } from "@/logic/client";
import type { ClientDocument } from "@/logic/document";
import {
  documentExtension,
  isAcceptableDocument,
  isDocumentType,
  labDateFromDocument,
  parseDocumentForm,
  sortDocuments,
  type DocumentForm,
  type DocumentFormError,
} from "@/logic/rules/documents";
import type { ClientRepository } from "@/data/repositories/clients";
import type { CourseRepository } from "@/data/repositories/courses";
import type { DocumentRepository, DocumentStorage } from "@/data/repositories/documents";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type DocumentDeps = {
  clients: ClientRepository;
  courses: CourseRepository;
  documents: DocumentRepository;
  storage: DocumentStorage;
};

/** DK1/DK3: the client's documents, newest first, with short-lived links for opening them. */
export async function listDocuments(
  deps: Pick<DocumentDeps, "documents" | "storage">,
  clientId: string,
): Promise<{ documents: ClientDocument[]; urls: Record<string, string> }> {
  if (!uuid.test(clientId)) return { documents: [], urls: {} };
  const documents = sortDocuments(await deps.documents.listByClient(clientId));
  return { documents, urls: await deps.storage.signedUrls(documents.map((d) => d.storagePath)) };
}

/** DK1: the upload page – the client and her active courses (LE8 «Прикрепить к курсу»). */
export async function getDocumentFormData(deps: Pick<DocumentDeps, "clients" | "courses">, clientId: string) {
  if (!uuid.test(clientId)) return null;
  const client = await deps.clients.get(clientId);
  if (!client) return null;
  const courses = (await deps.courses.listByClient(clientId)).filter((c) => c.status === "active");
  return {
    client: { id: client.id, fullName: client.fullName },
    courses: courses.map((c) => ({ id: c.id, diagnosis: c.diagnosis, labControl: c.labInterval !== null })),
  };
}

/** DK1, step 1: check the file and get a one-time link for uploading it straight to Storage. */
export async function prepareDocumentUpload(
  deps: Pick<DocumentDeps, "clients" | "storage">,
  clientId: string,
  file: { type: string; size: number },
): Promise<{ ok: true; path: string; uploadUrl: string } | { ok: false; error: DocumentFormError | "notFound" }> {
  if (!uuid.test(clientId) || !(await deps.clients.get(clientId))) return { ok: false, error: "notFound" };
  if (!isAcceptableDocument(file) || !isDocumentType(file.type)) return { ok: false, error: "fileInvalid" };
  return { ok: true, ...(await deps.storage.createUpload(clientId, documentExtension(file.type))) };
}

/**
 * DK1/LE8, step 2: after the upload, save the row – title, date, optional course. With
 * «Отметить анализы сданными?» the course's last tests get the document's date.
 */
export async function registerDocument(
  deps: DocumentDeps,
  clientId: string,
  file: { path: string; type: string; size: number },
  form: DocumentForm,
  today: IsoDate,
): Promise<{ ok: true; id: string } | { ok: false; error: DocumentFormError | "notFound" }> {
  if (!uuid.test(clientId) || !(await deps.clients.get(clientId))) return { ok: false, error: "notFound" };
  const parsed = parseDocumentForm(form, today);
  if (!parsed.ok) return parsed;
  if (!isAcceptableDocument(file) || !isDocumentType(file.type)) return { ok: false, error: "fileInvalid" };
  // Only a file in this client's folder that was really uploaded.
  if (file.path.split("/")[1] !== clientId || !(await deps.storage.exists(file.path))) return { ok: false, error: "fileInvalid" };

  const course = parsed.courseId && uuid.test(parsed.courseId) ? await deps.courses.get(parsed.courseId) : null;
  const courseId = course && course.clientId === clientId ? course.id : null;

  const { id } = await deps.documents.create(clientId, {
    courseId,
    title: parsed.title,
    documentDate: parsed.documentDate,
    storagePath: file.path,
    mimeType: file.type,
    sizeBytes: file.size,
  });
  if (course && courseId && parsed.markLabs && course.labInterval) {
    await deps.courses.patch(course.id, { lastLabDate: labDateFromDocument(parsed.documentDate, today) });
  }
  return { ok: true, id };
}

/** DK5: delete the row and the file (the UI asks for confirmation first). */
export async function deleteDocument(
  deps: Pick<DocumentDeps, "documents" | "storage">,
  clientId: string,
  documentId: string,
): Promise<boolean> {
  if (!uuid.test(clientId) || !uuid.test(documentId)) return false;
  const doc = await deps.documents.get(documentId);
  if (!doc || doc.clientId !== clientId) return false;
  await deps.storage.remove([doc.storagePath]);
  return deps.documents.delete(doc.id);
}
