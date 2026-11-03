"use server";

import { revalidatePath } from "next/cache";
import { practiceTimeZone } from "@/config/time";
import {
  archiveLogRepository,
  careRepository,
  clientPhotoRepository,
  clientRepository,
  courseRepository,
  documentRepository,
  documentStorage,
  photoStorage,
  visitRepository,
} from "@/data/repositories/server";
import type { IsoDate } from "@/logic/client";
import { todayIn } from "@/logic/rules/dates";
import { getArchiveClient, listArchiveClients, recordArchive, type ArchiveClient } from "@/logic/usecases/archive";

/** EX1 «Скачать архив»: the clients to put in the archive (A–Я) and the archive's date. */
export async function archiveStartAction(): Promise<{ ok: true; today: IsoDate; clients: { id: string; fullName: string }[] } | { ok: false }> {
  try {
    return { ok: true, today: todayIn(practiceTimeZone), clients: await listArchiveClients(await clientRepository()) };
  } catch {
    return { ok: false };
  }
}

/**
 * EX1 «Скачать архив»: one client for her page, with short-lived links to her files – the browser
 * downloads them straight from Storage and packs the archive itself.
 */
export async function archiveClientAction(
  clientId: string,
): Promise<{ ok: true; client: ArchiveClient; files: { archivePath: string; url: string | null }[] } | { ok: false }> {
  try {
    const deps = {
      clients: await clientRepository(),
      visits: await visitRepository(),
      courses: await courseRepository(),
      care: await careRepository(),
      documents: await documentRepository(),
      clientPhotos: await clientPhotoRepository(),
    };
    const found = await getArchiveClient(deps, clientId, todayIn(practiceTimeZone));
    if (!found) return { ok: false };
    const photos = found.files.filter((f) => f.bucket === "visit-photos").map((f) => f.storagePath);
    const documents = found.files.filter((f) => f.bucket === "client-documents").map((f) => f.storagePath);
    const urls = {
      ...(photos.length > 0 ? await (await photoStorage()).signedUrls(photos) : {}),
      ...(documents.length > 0 ? await (await documentStorage()).signedUrls(documents) : {}),
    };
    return { ok: true, client: found.client, files: found.files.map((f) => ({ archivePath: f.archivePath, url: urls[f.storagePath] ?? null })) };
  } catch {
    return { ok: false };
  }
}

/** EX1: the archive was saved – «Последний архив» moves to today. */
export async function archiveSavedAction(): Promise<{ ok: boolean }> {
  try {
    await recordArchive(await archiveLogRepository());
    revalidatePath("/clients");
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
