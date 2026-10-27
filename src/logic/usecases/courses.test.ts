import { describe, expect, it } from "vitest";
import type { Client } from "@/logic/client";
import type { TreatmentCourse } from "@/logic/course";
import type { ClientRepository } from "@/data/repositories/clients";
import type { CourseRepository } from "@/data/repositories/courses";
import type { PhotoStorage } from "@/data/repositories/photos";
import {
  completeCourse,
  extendCourse,
  getCourseFormData,
  listCoursesForCard,
  markLabsDone,
  saveCourse,
  setLastLabDate,
} from "./courses";
import type { PhotoUpload } from "./visits";

const today = "2026-10-28";
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const clientA = id(1);
const clientB = id(2);
const jpeg = (): PhotoUpload => ({ bytes: new Uint8Array([0xff, 0xd8]), type: "image/jpeg", size: 300_000 });
const noPhotos = { add: [], removeIds: [] };
const course = { diagnosis: "Акне", prescription: "Изотретиноин 20 мг", startDate: "2026-09-01", endDate: "2027-01-31" };

function memory() {
  let n = 100;
  const clients: Client[] = [clientA, clientB].map((cid, i) => ({
    id: cid,
    fullName: i === 0 ? "Анна Выдуманная" : "Вера Примерная",
    cardDate: "2026-01-01",
    ageAtRegistration: null,
    birthDate: null,
    phone: null,
    email: null,
    residenceCountry: null,
    residenceCity: null,
    language: "ru",
    anamnesis: {},
    notes: null,
    procedurePlan: null,
    anamnesisConfirmedAt: null,
    visitDates: [],
    direction: i === 0 ? ["cosmetology"] : [],
    courses: [],
    careText: null,
    careUpdatedAt: null,
    updatedAt: "2026-01-01T00:00:00Z",
  }));
  const courses: TreatmentCourse[] = [];
  const stored = new Set<string>();
  const clientRepo = {
    get: async (cid: string) => clients.find((c) => c.id === cid) ?? null,
    setDirection: async (cid: string, direction: Client["direction"]) => {
      clients.find((c) => c.id === cid)!.direction = direction;
      return true;
    },
  } as unknown as ClientRepository;
  const courseRepo: CourseRepository = {
    listByClient: async (cid) => courses.filter((c) => c.clientId === cid),
    get: async (kid) => courses.find((c) => c.id === kid) ?? null,
    create: async (cid, input) => {
      const kid = id(n++);
      courses.push({ ...input, id: kid, clientId: cid, status: "active", completedAt: null, createdAt: "t", photos: [] });
      return { id: kid };
    },
    update: async (kid, input) => {
      const c = courses.find((x) => x.id === kid);
      if (c) Object.assign(c, input);
      return Boolean(c);
    },
    patch: async (kid, patch) => {
      const c = courses.find((x) => x.id === kid);
      if (c) Object.assign(c, patch);
      return Boolean(c);
    },
    addPhoto: async (kid, storagePath) => {
      courses.find((x) => x.id === kid)!.photos.unshift({ id: id(n++), storagePath, createdAt: `t${n}` });
    },
    removePhotos: async (kid, ids) => {
      const c = courses.find((x) => x.id === kid)!;
      c.photos = c.photos.filter((p) => !ids.includes(p.id));
    },
  };
  const photos: PhotoStorage = {
    upload: async (folder) => {
      const path = `doc/${folder}/${n++}.jpg`;
      stored.add(path);
      return path;
    },
    remove: async (paths) => paths.forEach((p) => stored.delete(p)),
    signedUrls: async (paths) => Object.fromEntries(paths.map((p) => [p, `https://signed/${p}`])),
  };
  return { deps: { clients: clientRepo, courses: courseRepo, photos }, clients, courses, stored };
}

describe("LE1: курс лечения", () => {
  it("LE1: creates a course with diagnosis, prescription and dates", async () => {
    const m = memory();
    const result = await saveCourse(m.deps, clientA, null, course, noPhotos, today);
    expect(result.ok).toBe(true);
    expect(m.courses[0]).toMatchObject({ ...course, status: "active", labInterval: null });
  });

  it("DM1: a new course sets «Дерматология» and keeps «Косметология»", async () => {
    const m = memory();
    await saveCourse(m.deps, clientA, null, course, noPhotos, today);
    await saveCourse(m.deps, clientB, null, course, noPhotos, today);
    expect(m.clients.map((c) => c.direction)).toEqual([["cosmetology", "dermatology"], ["dermatology"]]);
  });

  it("LE1: a course is only reachable through its own client", async () => {
    const m = memory();
    const { id: kid } = (await saveCourse(m.deps, clientA, null, course, noPhotos, today)) as { id: string };
    expect(await getCourseFormData(m.deps, clientB, kid)).toBeNull();
    expect(await saveCourse(m.deps, clientB, kid, course, noPhotos, today)).toEqual({ ok: false, notFound: true });
    expect(await completeCourse(m.deps, clientB, kid, today)).toBe(false);
  });
});

describe("LE3: фото рецептов", () => {
  it("LE3: stores prescription photos under courses/<course id>, newest first, and adds more later", async () => {
    const m = memory();
    const { id: kid } = (await saveCourse(m.deps, clientA, null, course, { add: [jpeg()], removeIds: [] }, today)) as { id: string };
    await saveCourse(m.deps, clientA, kid, course, { add: [jpeg()], removeIds: [] }, today);
    const photos = m.courses[0].photos;
    expect(photos).toHaveLength(2);
    expect(photos.every((p) => p.storagePath.startsWith(`doc/courses/${kid}/`))).toBe(true);
    const { photoUrls } = await listCoursesForCard(m.deps, clientA);
    expect(Object.keys(photoUrls)).toHaveLength(2);
  });

  it("LE3: removing a photo deletes the file; more than 3 at once is refused", async () => {
    const m = memory();
    const { id: kid } = (await saveCourse(m.deps, clientA, null, course, { add: [jpeg()], removeIds: [] }, today)) as { id: string };
    await saveCourse(m.deps, clientA, kid, course, { add: [], removeIds: [m.courses[0].photos[0].id] }, today);
    expect(m.courses[0].photos).toHaveLength(0);
    expect(m.stored.size).toBe(0);
    expect(await saveCourse(m.deps, clientA, kid, course, { add: [jpeg(), jpeg(), jpeg(), jpeg()], removeIds: [] }, today)).toEqual({
      ok: false,
      errors: { photos: "tooManyPhotos" },
    });
  });
});

describe("LE2/LE9: продлить и завершить", () => {
  it("LE2: «Продлить» sets a new end date", async () => {
    const m = memory();
    const { id: kid } = (await saveCourse(m.deps, clientA, null, course, noPhotos, today)) as { id: string };
    expect(await extendCourse(m.deps, clientA, kid, "2027-04-30")).toEqual({ ok: true });
    expect(m.courses[0].endDate).toBe("2027-04-30");
    expect(await extendCourse(m.deps, clientA, kid, "2026-01-01")).toEqual({ ok: false, error: "endBeforeStart" });
  });

  it("LE9: «Завершить курс» moves the course to the completed ones", async () => {
    const m = memory();
    const { id: kid } = (await saveCourse(m.deps, clientA, null, course, noPhotos, today)) as { id: string };
    expect(await completeCourse(m.deps, clientA, kid, today)).toBe(true);
    const { active, completed } = await listCoursesForCard(m.deps, clientA);
    expect([active.length, completed.map((c) => c.completedAt)]).toEqual([0, [today]]);
  });
});

describe("LE6: контроль анализов", () => {
  it("LE6: «Анализы сданы ✓» stores today as the last tests", async () => {
    const m = memory();
    const form = { ...course, labEnabled: "1", labValue: "2,5", labUnit: "months" };
    const { id: kid } = (await saveCourse(m.deps, clientA, null, form, noPhotos, today)) as { id: string };
    expect(await markLabsDone(m.deps, clientA, kid, today)).toBe(true);
    expect(m.courses[0]).toMatchObject({ lastLabDate: today, labInterval: { value: 2.5, unit: "months" } });
  });

  it("LE6: the last tests date can be changed or cleared", async () => {
    const m = memory();
    const form = { ...course, labEnabled: "1", labValue: "2,5", labUnit: "months", lastLabDate: "2026-10-01" };
    const { id: kid } = (await saveCourse(m.deps, clientA, null, form, noPhotos, today)) as { id: string };
    expect(await setLastLabDate(m.deps, clientA, kid, "2026-10-10", today)).toBe(true);
    expect(m.courses[0].lastLabDate).toBe("2026-10-10");
    expect(await setLastLabDate(m.deps, clientA, kid, "", today)).toBe(true);
    expect(m.courses[0].lastLabDate).toBeNull();
    expect(await setLastLabDate(m.deps, clientA, kid, "2027-01-01", today)).toBe(false);
    expect(await setLastLabDate(m.deps, clientB, kid, "", today)).toBe(false);
  });

  it("LE6: nothing to mark without lab control", async () => {
    const m = memory();
    const { id: kid } = (await saveCourse(m.deps, clientA, null, course, noPhotos, today)) as { id: string };
    expect(await markLabsDone(m.deps, clientA, kid, today)).toBe(false);
  });
});
