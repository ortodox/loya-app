import { describe, expect, it } from "vitest";
import type { Client, Visit } from "@/logic/client";
import type { TreatmentCourse } from "@/logic/course";
import type { ArchiveDeps } from "./archive";
import { collectArchive } from "./archive";

const today = "2026-11-03";
const client = (id: string, fullName: string, extra: Partial<Client> = {}) =>
  ({ id, fullName, cardDate: "2026-01-10", ageAtRegistration: 40, birthDate: null, anamnesis: {}, careText: "Крем SPF", careUpdatedAt: "2026-10-01", direction: [], courses: [], visitDates: [], ...extra }) as unknown as Client;
const visit = (id: string, clientId: string, visitDate: string, photos: string[]) =>
  ({ id, clientId, visitDate, createdAt: `${visitDate}T10:00:00Z`, items: [], photos: photos.map((p, i) => ({ id: `${id}-${i}`, storagePath: p, sortOrder: i })) }) as unknown as Visit;

function deps(): ArchiveDeps {
  const clients = [client("b", "Яна Пример"), client("a", "Анна Выдуманная")];
  const visits = [visit("v1", "a", "2026-09-01", ["d/v1/p1.jpg"]), visit("v2", "a", "2026-10-20", []), visit("v3", "b", "2026-10-01", [])];
  const course = { id: "k1", clientId: "a", status: "active", startDate: "2026-10-01", endDate: "2027-01-01", completedAt: null, photos: [{ id: "kp", storagePath: "d/courses/k1/r.jpg" }] } as unknown as TreatmentCourse;
  return {
    clients: { list: async () => clients } as unknown as ArchiveDeps["clients"],
    visits: { listByClient: async (id: string) => visits.filter((v) => v.clientId === id) } as unknown as ArchiveDeps["visits"],
    courses: { listByClient: async (id: string) => (id === "a" ? [course] : []) } as unknown as ArchiveDeps["courses"],
    care: { listPhotos: async (id: string) => (id === "a" ? [{ id: "c", storagePath: "d/care/a/c.jpg", sortOrder: 0 }] : []) } as unknown as ArchiveDeps["care"],
    documents: {
      listByClient: async (id: string) =>
        id === "a" ? [{ id: "doc", clientId: "a", courseId: null, title: "Анализ", documentDate: "2026-10-05", storagePath: "d/a/x.pdf", mimeType: "application/pdf", sizeBytes: 1, createdAt: "t" }] : [],
    } as unknown as ArchiveDeps["documents"],
    clientPhotos: {
      listByClient: async (id: string) => (id === "a" ? [{ id: "f", clientId: "a", courseId: null, takenOn: "2026-10-02", storagePath: "d/client-photos/a/f.jpg", createdAt: "t" }] : []),
    } as unknown as ArchiveDeps["clientPhotos"],
  };
}

describe("EX1: архив в HTML", () => {
  it("EX1: active clients A–Я, visits newest first, the card as of the backup day", async () => {
    const data = await collectArchive(deps(), today);
    expect(data.createdOn).toBe(today);
    expect(data.clients.map((c) => c.card.client.fullName)).toEqual(["Анна Выдуманная", "Яна Пример"]);
    expect(data.clients[0].visits.map((v) => v.id)).toEqual(["v2", "v1"]);
    expect(data.clients[0].card.age).toBe(40);
    expect(data.clients[0].care).toMatchObject({ text: "Крем SPF", updatedAt: "2026-10-01" });
    expect(data.clients[0].courses.active.map((k) => k.id)).toEqual(["k1"]);
  });

  it("EX1: every file the pages show, in its bucket – sticker, course, «Уход», client photo, document", async () => {
    const { files } = await collectArchive(deps(), today);
    expect(files).toEqual([
      { bucket: "visit-photos", storagePath: "d/v1/p1.jpg", archivePath: "filer/visit-photos/v1/p1.jpg" },
      { bucket: "visit-photos", storagePath: "d/courses/k1/r.jpg", archivePath: "filer/visit-photos/courses/k1/r.jpg" },
      { bucket: "visit-photos", storagePath: "d/care/a/c.jpg", archivePath: "filer/visit-photos/care/a/c.jpg" },
      { bucket: "visit-photos", storagePath: "d/client-photos/a/f.jpg", archivePath: "filer/visit-photos/client-photos/a/f.jpg" },
      { bucket: "client-documents", storagePath: "d/a/x.pdf", archivePath: "filer/client-documents/a/x.pdf" },
    ]);
  });
});
