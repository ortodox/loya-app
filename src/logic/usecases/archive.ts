import type { IsoDate, Visit } from "@/logic/client";
import type { ClientPhoto } from "@/logic/client-photo";
import type { TreatmentCourse } from "@/logic/course";
import type { Care, ClientDocument } from "@/logic/document";
import { archiveFilePath, sortByName, type ArchiveBucket } from "@/logic/rules/archive";
import { splitCourses } from "@/logic/rules/courses";
import { sortDocuments } from "@/logic/rules/documents";
import { sortVisitsNewestFirst } from "@/logic/rules/visits";
import type { CareRepository } from "@/data/repositories/care";
import type { ClientPhotoRepository } from "@/data/repositories/client-photos";
import type { ClientRepository } from "@/data/repositories/clients";
import type { CourseRepository } from "@/data/repositories/courses";
import type { DocumentRepository } from "@/data/repositories/documents";
import type { VisitRepository } from "@/data/repositories/visits";
import { clientCard, type ClientCard } from "./clients";

export type ArchiveDeps = {
  clients: ClientRepository;
  visits: VisitRepository;
  courses: CourseRepository;
  care: CareRepository;
  documents: DocumentRepository;
  clientPhotos: ClientPhotoRepository;
};

/** EX1: everything the card shows about one client, as it is on the day of the backup. */
export type ArchiveClient = {
  card: ClientCard;
  visits: Visit[];
  courses: { active: TreatmentCourse[]; completed: TreatmentCourse[] };
  care: Care;
  documents: ClientDocument[];
  photos: ClientPhoto[];
};

/** EX1: a stored file and where its copy lies in the archive. */
export type ArchiveFile = { bucket: ArchiveBucket; storagePath: string; archivePath: string };

export type ArchiveData = { createdOn: IsoDate; clients: ArchiveClient[]; files: ArchiveFile[] };

/**
 * EX1: the backup for people – every active client (not «Удалённые клиенты») with visits,
 * courses, «Уход», documents and photos, and the list of files to copy next to the pages.
 */
export async function collectArchive(deps: ArchiveDeps, today: IsoDate): Promise<ArchiveData> {
  const clients: ArchiveClient[] = [];
  for (const client of sortByName(await deps.clients.list())) {
    const [visits, courses, carePhotos, documents, photos] = await Promise.all([
      deps.visits.listByClient(client.id),
      deps.courses.listByClient(client.id),
      deps.care.listPhotos(client.id),
      deps.documents.listByClient(client.id),
      deps.clientPhotos.listByClient(client.id),
    ]);
    clients.push({
      card: clientCard(client, today),
      visits: sortVisitsNewestFirst(visits),
      courses: splitCourses(courses),
      care: { text: client.careText, updatedAt: client.careUpdatedAt, photos: carePhotos },
      documents: sortDocuments(documents),
      photos,
    });
  }
  return { createdOn: today, clients, files: archiveFiles(clients) };
}

/** EX1: every file the pages show – originals only (the small copies are not needed). */
export function archiveFiles(clients: readonly ArchiveClient[]): ArchiveFile[] {
  const file = (bucket: ArchiveBucket, storagePath: string): ArchiveFile => ({ bucket, storagePath, archivePath: archiveFilePath(bucket, storagePath) });
  return clients.flatMap((c) => [
    ...c.visits.flatMap((v) => v.photos.map((p) => file("visit-photos", p.storagePath))),
    ...[...c.courses.active, ...c.courses.completed].flatMap((k) => k.photos.map((p) => file("visit-photos", p.storagePath))),
    ...c.care.photos.map((p) => file("visit-photos", p.storagePath)),
    ...c.photos.map((p) => file("visit-photos", p.storagePath)),
    ...c.documents.map((d) => file("client-documents", d.storagePath)),
  ]);
}
