import type { Client, IsoDate, Visit } from "@/logic/client";
import type { ClientPhoto } from "@/logic/client-photo";
import type { TreatmentCourse } from "@/logic/course";
import type { Care, ClientDocument } from "@/logic/document";
import { archiveFilePath, sortByName, type ArchiveBucket } from "@/logic/rules/archive";
import { splitCourses } from "@/logic/rules/courses";
import { todayIn } from "@/logic/rules/dates";
import { sortDocuments } from "@/logic/rules/documents";
import { sortVisitsNewestFirst } from "@/logic/rules/visits";
import type { CareRepository } from "@/data/repositories/care";
import type { ClientPhotoRepository } from "@/data/repositories/client-photos";
import type { ClientRepository } from "@/data/repositories/clients";
import type { CourseRepository } from "@/data/repositories/courses";
import type { DocumentRepository } from "@/data/repositories/documents";
import type { VisitRepository } from "@/data/repositories/visits";
import type { ArchiveLogRepository } from "@/data/repositories/archive-log";
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
  for (const client of sortByName(await deps.clients.list())) clients.push(await withEverything(deps, client, today));
  return { createdOn: today, clients, files: archiveFiles(clients) };
}

/** EX1 «Скачать архив»: who goes into the archive, A–Я – the browser then fetches them one by one. */
export async function listArchiveClients(clients: ClientRepository): Promise<{ id: string; fullName: string }[]> {
  return sortByName(await clients.list()).map((c) => ({ id: c.id, fullName: c.fullName }));
}

/** EX1 «Скачать архив»: one client with everything for her page and her files; null for unknown or deleted clients. */
export async function getArchiveClient(deps: ArchiveDeps, clientId: string, today: IsoDate): Promise<{ client: ArchiveClient; files: ArchiveFile[] } | null> {
  if (!uuid.test(clientId)) return null;
  const client = await deps.clients.get(clientId);
  if (!client) return null;
  const archived = await withEverything(deps, client, today);
  return { client: archived, files: archiveFiles([archived]) };
}

async function withEverything(deps: ArchiveDeps, client: Client, today: IsoDate): Promise<ArchiveClient> {
  const [visits, courses, carePhotos, documents, photos] = await Promise.all([
    deps.visits.listByClient(client.id),
    deps.courses.listByClient(client.id),
    deps.care.listPhotos(client.id),
    deps.documents.listByClient(client.id),
    deps.clientPhotos.listByClient(client.id),
  ]);
  return {
    card: clientCard(client, today),
    visits: sortVisitsNewestFirst(visits),
    courses: splitCourses(courses),
    care: { text: client.careText, updatedAt: client.careUpdatedAt, photos: carePhotos },
    documents: sortDocuments(documents),
    photos,
  };
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

/** EX1: when «Скачать архив» was last used – shown at the bottom of the client list. */
export async function lastArchiveDate(log: ArchiveLogRepository, timeZone: string): Promise<IsoDate | null> {
  const at = await log.lastDownload();
  return at ? todayIn(timeZone, new Date(at)) : null;
}

/** EX1: the archive was saved – remember the time (for «Последний архив»). */
export async function recordArchive(log: ArchiveLogRepository): Promise<void> {
  await log.recordDownload();
}
