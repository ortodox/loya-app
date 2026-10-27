import { describe, expect, it } from "vitest";
import type { Client } from "@/logic/client";
import type { TreatmentCourse } from "@/logic/course";
import type { CarePhoto, ClientDocument } from "@/logic/document";
import type { CareRepository } from "@/data/repositories/care";
import type { ClientRepository } from "@/data/repositories/clients";
import type { CourseRepository } from "@/data/repositories/courses";
import type { DocumentRepository, DocumentStorage } from "@/data/repositories/documents";
import type { PhotoStorage } from "@/data/repositories/photos";
import { getCare, saveCare } from "./care";
import { deleteDocument, getDocumentFormData, listDocuments, prepareDocumentUpload, registerDocument } from "./documents";
import type { PhotoUpload } from "./visits";

const today = "2026-10-28";
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const clientA = id(1);
const clientB = id(2);
const courseA = id(10);
const jpeg = (): PhotoUpload => ({ bytes: new Uint8Array([0xff, 0xd8]), type: "image/jpeg", size: 300_000 });
const pdf = { type: "application/pdf", size: 2_000_000 };

function memory() {
  let n = 100;
  const clients = [clientA, clientB].map((cid) => ({ id: cid, careText: null, careUpdatedAt: null }) as unknown as Client);
  const courses: TreatmentCourse[] = [
    {
      id: courseA, clientId: clientA, diagnosis: "Акне", prescription: null, startDate: "2026-09-01", endDate: "2027-02-28",
      labInterval: { value: 2.5, unit: "months" }, lastLabDate: null, status: "active", completedAt: null, createdAt: "t", photos: [],
    },
  ];
  const documents: ClientDocument[] = [];
  const files = new Set<string>();
  const carePhotos: (CarePhoto & { clientId: string })[] = [];
  const clientRepo = { get: async (cid: string) => clients.find((c) => c.id === cid) ?? null } as unknown as ClientRepository;
  const courseRepo = {
    listByClient: async (cid: string) => courses.filter((c) => c.clientId === cid),
    get: async (kid: string) => courses.find((c) => c.id === kid) ?? null,
    patch: async (kid: string, patch: Partial<TreatmentCourse>) => Boolean(Object.assign(courses.find((c) => c.id === kid)!, patch)),
  } as unknown as CourseRepository;
  const docRepo: DocumentRepository = {
    listByClient: async (cid) => documents.filter((d) => d.clientId === cid),
    get: async (did) => documents.find((d) => d.id === did) ?? null,
    create: async (cid, input) => {
      const did = id(n++);
      documents.push({ ...input, id: did, clientId: cid, createdAt: `t${n}` });
      return { id: did };
    },
    delete: async (did) => {
      const i = documents.findIndex((d) => d.id === did);
      if (i >= 0) documents.splice(i, 1);
      return i >= 0;
    },
  };
  const storage: DocumentStorage = {
    createUpload: async (cid, ext) => ({ path: `doc/${cid}/${n++}.${ext}`, uploadUrl: "https://upload" }),
    exists: async (path) => files.has(path),
    remove: async (paths) => paths.forEach((p) => files.delete(p)),
    signedUrls: async (paths) => Object.fromEntries(paths.map((p) => [p, `https://signed/${p}`])),
  };
  const careRepo: CareRepository = {
    listPhotos: async (cid) => carePhotos.filter((p) => p.clientId === cid),
    setText: async (cid, text, updatedAt) => Boolean(Object.assign(clients.find((c) => c.id === cid)!, { careText: text, careUpdatedAt: updatedAt })),
    addPhoto: async (cid, storagePath, sortOrder) => void carePhotos.push({ id: id(n++), clientId: cid, storagePath, sortOrder }),
    removePhotos: async (cid, ids) => {
      for (const pid of ids) carePhotos.splice(carePhotos.findIndex((p) => p.id === pid), 1);
    },
  };
  const photoFiles = new Set<string>();
  const photos: PhotoStorage = {
    upload: async (folder) => {
      const p = `doc/${folder}/${n++}.jpg`;
      photoFiles.add(p);
      return p;
    },
    remove: async (paths) => paths.forEach((p) => photoFiles.delete(p)),
    signedUrls: async (paths) => Object.fromEntries(paths.map((p) => [p, `https://signed/${p}`])),
  };
  const docDeps = { clients: clientRepo, courses: courseRepo, documents: docRepo, storage };
  const careDeps = { clients: clientRepo, care: careRepo, photos };
  async function upload(cid: string, form = {}, file = pdf) {
    const prepared = await prepareDocumentUpload(docDeps, cid, file);
    if (!prepared.ok) return prepared;
    files.add(prepared.path); // the browser uploads to the signed link
    return registerDocument(docDeps, cid, { ...file, path: prepared.path }, form, today);
  }
  return { docDeps, careDeps, documents, files, courses, clients, carePhotos, photoFiles, upload };
}

describe("DK1: загрузить документ", () => {
  it("DK1: uploads a PDF with title and date; the list shows it with a link", async () => {
    const m = memory();
    expect(await m.upload(clientA, { title: "Биохимия", documentDate: "2026-10-20" })).toMatchObject({ ok: true });
    const { documents, urls } = await listDocuments(m.docDeps, clientA);
    expect(documents).toMatchObject([{ title: "Биохимия", documentDate: "2026-10-20", mimeType: "application/pdf", courseId: null }]);
    expect(urls[documents[0].storagePath]).toMatch(/^https:\/\/signed\//);
  });

  it("DK1: refuses other file types and files over 20 MB", async () => {
    const m = memory();
    expect(await prepareDocumentUpload(m.docDeps, clientA, { type: "application/zip", size: 1000 })).toEqual({ ok: false, error: "fileInvalid" });
    expect(await prepareDocumentUpload(m.docDeps, clientA, { type: "application/pdf", size: 21 * 1024 * 1024 })).toEqual({ ok: false, error: "fileInvalid" });
  });

  it("DK1: a row is only saved for a file that was uploaded to this client's folder", async () => {
    const m = memory();
    const prepared = (await prepareDocumentUpload(m.docDeps, clientA, pdf)) as { path: string };
    expect(await registerDocument(m.docDeps, clientA, { ...pdf, path: prepared.path }, {}, today)).toEqual({ ok: false, error: "fileInvalid" });
    m.files.add(prepared.path);
    expect(await registerDocument(m.docDeps, clientB, { ...pdf, path: prepared.path }, {}, today)).toEqual({ ok: false, error: "fileInvalid" });
    expect(m.documents).toHaveLength(0);
  });
});

describe("DK5: удалить документ", () => {
  it("DK5: deletes the row and the file, only through its own client", async () => {
    const m = memory();
    const { id: did } = (await m.upload(clientA)) as { id: string };
    expect(await deleteDocument(m.docDeps, clientB, did)).toBe(false);
    expect(await deleteDocument(m.docDeps, clientA, did)).toBe(true);
    expect([m.documents.length, m.files.size]).toEqual([0, 0]);
  });
});

describe("LE8: анализы в курсе", () => {
  it("LE8: the upload page offers the active courses and says which have lab control", async () => {
    const m = memory();
    expect((await getDocumentFormData(m.docDeps, clientA))!.courses).toEqual([{ id: courseA, diagnosis: "Акне", labControl: true }]);
  });

  it("LE8: a document tied to a course with «Отметить анализы сданными» sets the last tests date", async () => {
    const m = memory();
    await m.upload(clientA, { courseId: courseA, markLabs: "1", documentDate: "2026-10-20" });
    expect(m.documents[0].courseId).toBe(courseA);
    expect(m.courses[0].lastLabDate).toBe("2026-10-20");
  });

  it("LE8: without the answer the tests stay as they were; another client's course is not attached", async () => {
    const m = memory();
    await m.upload(clientA, { courseId: courseA });
    expect(m.courses[0].lastLabDate).toBeNull();
    await m.upload(clientB, { courseId: courseA, markLabs: "1" });
    expect(m.documents[1].courseId).toBeNull();
    expect(m.courses[0].lastLabDate).toBeNull();
  });
});

describe("UH1/UH2: уход", () => {
  it("UH1: saves the text and «Обновлено» only when something changed", async () => {
    const m = memory();
    await saveCare(m.careDeps, clientA, { text: "Утро: умывание, SPF 50\n" }, { add: [], removeIds: [] }, "2026-10-20");
    expect(m.clients[0]).toMatchObject({ careText: "Утро: умывание, SPF 50", careUpdatedAt: "2026-10-20" });
    await saveCare(m.careDeps, clientA, { text: "Утро: умывание, SPF 50" }, { add: [], removeIds: [] }, today);
    expect(m.clients[0].careUpdatedAt).toBe("2026-10-20");
  });

  it("UH2: photos under care/<client id>; removing one deletes the file", async () => {
    const m = memory();
    await saveCare(m.careDeps, clientA, { text: "" }, { add: [jpeg(), jpeg()], removeIds: [] }, today);
    const { care, photoUrls } = (await getCare(m.careDeps, clientA))!;
    expect(care.photos.every((p) => p.storagePath.startsWith(`doc/care/${clientA}/`))).toBe(true);
    expect(Object.keys(photoUrls)).toHaveLength(2);
    await saveCare(m.careDeps, clientA, { text: "" }, { add: [], removeIds: [care.photos[0].id] }, today);
    expect([m.carePhotos.length, m.photoFiles.size]).toEqual([1, 1]);
    expect(await saveCare(m.careDeps, clientA, {}, { add: [jpeg(), jpeg(), jpeg(), jpeg()], removeIds: [] }, today)).toEqual({
      ok: false,
      errors: { photos: "tooManyPhotos" },
    });
  });
});
