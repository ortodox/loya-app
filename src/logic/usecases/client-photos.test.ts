import { describe, expect, it } from "vitest";
import type { Client } from "@/logic/client";
import type { ClientPhoto } from "@/logic/client-photo";
import type { TreatmentCourse } from "@/logic/course";
import type { ClientPhotoRepository } from "@/data/repositories/client-photos";
import type { ClientRepository } from "@/data/repositories/clients";
import type { CourseRepository } from "@/data/repositories/courses";
import type { PhotoStorage } from "@/data/repositories/photos";
import { addClientPhotos, deleteClientPhoto, getClientPhotoFormData, listClientPhotos } from "./client-photos";
import type { PhotoUpload } from "./visits";

const today = "2026-10-30";
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const clientA = id(1);
const clientB = id(2);
const activeA = id(10);
const doneA = id(11);
const activeB = id(12);
const jpeg = (): PhotoUpload => ({ bytes: new Uint8Array([0xff, 0xd8]), type: "image/jpeg", size: 300_000 });

function memory() {
  let n = 100;
  const clients = [clientA, clientB].map((cid) => ({ id: cid, fullName: `Клиент ${cid.slice(-1)}` }) as unknown as Client);
  const course = (kid: string, clientId: string, status: TreatmentCourse["status"]) =>
    ({ id: kid, clientId, diagnosis: "Акне", status }) as TreatmentCourse;
  const courses = [course(activeA, clientA, "active"), course(doneA, clientA, "completed"), course(activeB, clientB, "active")];
  const stored: ClientPhoto[] = [];
  const files = new Set<string>();
  const clientRepo = { get: async (cid: string) => clients.find((c) => c.id === cid) ?? null } as unknown as ClientRepository;
  const courseRepo = { get: async (kid: string) => courses.find((c) => c.id === kid) ?? null } as unknown as CourseRepository;
  const clientPhotos: ClientPhotoRepository = {
    listByClient: async (cid) => stored.filter((p) => p.clientId === cid),
    add: async (cid, input) => void stored.push({ ...input, id: id(n++), clientId: cid, createdAt: `t${n}` }),
    remove: async (cid, pid) => {
      const i = stored.findIndex((p) => p.id === pid && p.clientId === cid);
      if (i >= 0) stored.splice(i, 1);
      return i >= 0;
    },
  };
  const photos: PhotoStorage = {
    upload: async (folder) => {
      const p = `doctor/${folder}/${n++}.jpg`;
      files.add(p);
      return p;
    },
    remove: async (paths) => paths.forEach((p) => files.delete(p)),
    signedUrls: async (paths) => Object.fromEntries(paths.map((p) => [p, `https://signed/${p}`])),
  };
  return { deps: { clients: clientRepo, courses: courseRepo, clientPhotos, photos }, stored, files };
}

describe("FK1: фото клиента в карте", () => {
  it("FK1: saves 1–3 photos in the client's own folder, with the date taken", async () => {
    const m = memory();
    expect(await addClientPhotos(m.deps, clientA, { takenOn: "2026-09-14" }, [jpeg(), jpeg()], today)).toEqual({ ok: true });
    expect(m.stored.map((p) => [p.courseId, p.takenOn])).toEqual([[null, "2026-09-14"], [null, "2026-09-14"]]);
    expect(m.stored.every((p) => p.storagePath.startsWith(`doctor/client-photos/${clientA}/`))).toBe(true);
    const { photos, urls } = await listClientPhotos(m.deps, clientA);
    expect(photos).toHaveLength(2);
    expect(urls[photos[0].storagePath]).toMatch(/^https:\/\/signed\//);
  });

  it("FK1: at least one and at most 3 photos, JPEG only, a valid date", async () => {
    const m = memory();
    const add = (uploads: PhotoUpload[], takenOn = "2026-09-14") => addClientPhotos(m.deps, clientA, { takenOn }, uploads, today);
    expect(await add([])).toEqual({ ok: false, errors: { photos: "noPhotos" } });
    expect(await add([jpeg(), jpeg(), jpeg(), jpeg()])).toEqual({ ok: false, errors: { photos: "tooManyPhotos" } });
    expect(await add([{ ...jpeg(), type: "image/png" }])).toEqual({ ok: false, errors: { photos: "photoInvalid" } });
    expect(await add([jpeg()], "2026-11-01")).toEqual({ ok: false, errors: { takenOn: "dateInvalid" } });
    expect(m.stored).toHaveLength(0);
    expect(m.files.size).toBe(0);
  });

  it("FK1: an unknown client is not found", async () => {
    const m = memory();
    expect(await addClientPhotos(m.deps, id(99), { takenOn: today }, [jpeg()], today)).toEqual({ ok: false, notFound: true });
    expect(await getClientPhotoFormData(m.deps, "nope", null)).toBeNull();
  });
});

describe("FK3: фото курса лечения в «Лечение»", () => {
  it("FK3: a photo added in «Лечение» belongs to the course", async () => {
    const m = memory();
    await addClientPhotos(m.deps, clientA, { takenOn: today, courseId: activeA }, [jpeg()], today);
    expect(m.stored[0].courseId).toBe(activeA);
    expect((await getClientPhotoFormData(m.deps, clientA, activeA))?.course).toEqual({ id: activeA, diagnosis: "Акне" });
  });

  it("FK3: only an active course of the same client", async () => {
    const m = memory();
    for (const courseId of [doneA, activeB, "nope"]) {
      expect(await addClientPhotos(m.deps, clientA, { takenOn: today, courseId }, [jpeg()], today)).toEqual({ ok: false, notFound: true });
    }
    expect(m.stored).toHaveLength(0);
  });
});

describe("FK4: удалить фото", () => {
  it("FK4: deletes the row and the file, only through its own client", async () => {
    const m = memory();
    await addClientPhotos(m.deps, clientA, { takenOn: today }, [jpeg()], today);
    const [photo] = m.stored;
    expect(await deleteClientPhoto(m.deps, clientB, photo.id)).toBe(false);
    expect(m.stored).toHaveLength(1);
    expect(await deleteClientPhoto(m.deps, clientA, photo.id)).toBe(true);
    expect(m.stored).toHaveLength(0);
    expect(m.files.size).toBe(0);
  });
});
