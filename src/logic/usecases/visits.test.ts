import { describe, expect, it } from "vitest";
import { emptySettings, type Preparation, type ProcedureType } from "@/logic/catalog";
import type { Client, Visit, VisitInput } from "@/logic/client";
import { DuplicateNameError, type CatalogRepository } from "@/data/repositories/catalog";
import type { ClientRepository } from "@/data/repositories/clients";
import type { PhotoStorage } from "@/data/repositories/photos";
import type { VisitRepository } from "@/data/repositories/visits";
import { listClients } from "./clients";
import { deleteVisit, getVisitFormData, listVisits, listVisitsForCard, saveVisit, type PhotoUpload } from "./visits";

const today = "2026-10-27";
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const clientA = id(1);
const clientB = id(2);
const botulinum = id(10);
const peel = id(11);
const botox = id(20);
const almond = id(21);
const jpeg = (size = 300_000): PhotoUpload => ({ bytes: new Uint8Array([0xff, 0xd8]), type: "image/jpeg", size });

const client = (cid: string, fullName: string, extra: Partial<Client> = {}): Client => ({
  id: cid,
  fullName,
  cardDate: "2024-03-15",
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
  direction: [],
  courses: [],
  careText: null,
  careUpdatedAt: null,
  updatedAt: "2026-01-01T00:00:00Z",
  ...extra,
});

function memory() {
  let n = 100;
  const clients = [
    client(clientA, "Анна Выдуманная", { language: "uk", anamnesis: { allergies: { text: "Лидокаин" } } }),
    client(clientB, "Вера Примерная", { cardDate: "2025-06-01" }),
  ];
  const types: ProcedureType[] = [
    { ...emptySettings, id: botulinum, code: "BT-01", name: { ru: "Ботулинотерапия" }, sortOrder: 10, zoneIds: [], doseText: "10–150", doseUnit: "ед.", advice: { ru: "Не ложиться 4 часа.", uk: "Не лягати 4 години." } },
    { ...emptySettings, id: peel, code: "BT-07", name: { ru: "Химический пилинг" }, sortOrder: 70, zoneIds: [], advice: { ru: "SPF 50 ежедневно." } },
  ];
  const preparations: Preparation[] = [
    { ...emptySettings, id: botox, procedureTypeId: botulinum, name: "Botox", manufacturer: "Allergan", favorite: true },
    { ...emptySettings, id: almond, procedureTypeId: peel, name: "Миндальный пилинг 40%", manufacturer: null, favorite: false, advice: { ru: "Шелушение не удалять." } },
  ];
  const visits: Visit[] = [];
  const stored = new Set<string>();
  const clientRepo: ClientRepository = {
    list: async () =>
      clients.map((c) => ({ ...c, visitDates: visits.filter((v) => v.clientId === c.id).map((v) => v.visitDate) })),
    get: async (cid) => clients.find((c) => c.id === cid) ?? null,
    create: async () => ({ id: "x" }),
    update: async () => true,
    setDirection: async () => true,
    confirmAnamnesis: async (cid, date) => {
      const c = clients.find((x) => x.id === cid);
      if (c) c.anamnesisConfirmedAt = date;
      return Boolean(c);
    },
  };
  const toVisit = (vid: string, clientId: string, input: VisitInput): Visit => ({
    id: vid,
    clientId,
    visitDate: input.visitDate,
    createdAt: `2026-10-27T10:00:${String(n).slice(-2)}Z`,
    notes: input.notes,
    recommendations: input.recommendations,
    recommendationsLang: input.recommendationsLang,
    recommendationsEdited: input.recommendationsEdited,
    faceScheme: input.faceScheme,
    items: input.items.map((it, i) => ({ ...it, id: id(n + 500 + i), sortOrder: i })),
    photos: [],
    archive: { homeCareRecommendations: null, procedurePlan: null },
  });
  const visitRepo: VisitRepository = {
    listByClient: async (cid) => visits.filter((v) => v.clientId === cid),
    get: async (vid) => visits.find((v) => v.id === vid) ?? null,
    create: async (clientId, input) => {
      const vid = id(n++);
      visits.push(toVisit(vid, clientId, input));
      return { id: vid };
    },
    update: async (vid, input) => {
      const i = visits.findIndex((v) => v.id === vid);
      if (i < 0) return false;
      visits[i] = { ...toVisit(vid, visits[i].clientId, input), photos: visits[i].photos, archive: visits[i].archive, createdAt: visits[i].createdAt };
      return true;
    },
    delete: async (vid) => {
      const i = visits.findIndex((v) => v.id === vid);
      if (i >= 0) visits.splice(i, 1);
      return i >= 0;
    },
    addPhoto: async (vid, storagePath, sortOrder) => {
      const v = visits.find((x) => x.id === vid)!;
      if (v.photos.length >= 3) throw new Error("max 3");
      v.photos.push({ id: id(n++), storagePath, sortOrder });
    },
    removePhotos: async (vid, ids) => {
      const v = visits.find((x) => x.id === vid)!;
      v.photos = v.photos.filter((p) => !ids.includes(p.id));
    },
  };
  const catalog: CatalogRepository = {
    listZones: async () => [],
    listTypes: async () => types,
    getType: async (tid) => types.find((t) => t.id === tid) ?? null,
    createType: async () => ({ id: "x" }),
    updateType: async () => true,
    listPreparations: async () => preparations,
    getPreparation: async (pid) => preparations.find((p) => p.id === pid) ?? null,
    createPreparation: async (input) => {
      if (preparations.some((p) => p.procedureTypeId === input.procedureTypeId && p.name === input.name)) throw new DuplicateNameError("dup");
      const pid = id(n++);
      preparations.push({ ...input, id: pid });
      return { id: pid };
    },
    updatePreparation: async () => true,
  };
  const photos: PhotoStorage = {
    upload: async (vid) => {
      const path = `doctor/${vid}/${n++}.jpg`;
      stored.add(path);
      return path;
    },
    remove: async (paths) => paths.forEach((p) => stored.delete(p)),
    signedUrls: async (paths) => Object.fromEntries(paths.map((p) => [p, `https://signed/${p}`])),
  };
  return { deps: { clients: clientRepo, visits: visitRepo, catalog, photos }, visits, preparations, stored, clients };
}

const noPhotos = { add: [], removeIds: [] };

describe("R1/DO1: препараты в визите", () => {
  it("R1/DO1: saves two preparations from the catalogue with a free-text quantity", async () => {
    const m = memory();
    const result = await saveVisit(
      m.deps,
      clientA,
      null,
      { items: [{ preparationId: botox, quantity: "20+15 ед." }, { preparationId: almond, quantity: "2 слоя" }] },
      noPhotos,
      today,
    );
    expect(result.ok).toBe(true);
    expect(m.visits[0].items.map((i) => [i.preparationName, i.quantity])).toEqual([
      ["Botox", "20+15 ед."],
      ["Миндальный пилинг 40%", "2 слоя"],
    ]);
  });

  it("R1: «Добавить вручную» saves the preparation in the catalogue under its type", async () => {
    const m = memory();
    await saveVisit(m.deps, clientA, null, { items: [{ manualName: "Новый пилинг", manualTypeId: peel, quantity: "1" }] }, noPhotos, today);
    const added = m.preparations.find((p) => p.name === "Новый пилинг");
    expect(added?.procedureTypeId).toBe(peel);
    expect(m.visits[0].items[0]).toMatchObject({ preparationId: added?.id, procedureTypeId: peel });
  });

  it("R1: a manual name that already exists in the type reuses the catalogue entry", async () => {
    const m = memory();
    await saveVisit(m.deps, clientA, null, { items: [{ manualName: "Botox", manualTypeId: botulinum }] }, noPhotos, today);
    expect(m.preparations.filter((p) => p.name === "Botox")).toHaveLength(1);
    expect(m.visits[0].items[0].preparationId).toBe(botox);
  });

  it("R1: nothing is written when a row is invalid", async () => {
    const m = memory();
    const result = await saveVisit(
      m.deps,
      clientA,
      null,
      { items: [{ manualName: "Новый", manualTypeId: peel }, { preparationId: id(99) }] },
      noPhotos,
      today,
    );
    expect(result).toEqual({ ok: false, errors: { items: "preparationNotFound" } });
    expect(m.visits).toHaveLength(0);
    expect(m.preparations.some((p) => p.name === "Новый")).toBe(false);
  });

  it("P9: the visit keeps the preparation name as it was at the time of the visit", async () => {
    const m = memory();
    await saveVisit(m.deps, clientA, null, { items: [{ preparationId: botox }] }, noPhotos, today);
    m.preparations[0].name = "Botox 100";
    expect((await listVisits(m.deps.visits, clientA))[0].items[0].preparationName).toBe("Botox");
  });
});

describe("LOT1: фото наклейки", () => {
  it("LOT1: uploads up to 3 photos for the whole visit", async () => {
    const m = memory();
    const result = await saveVisit(m.deps, clientA, null, {}, { add: [jpeg(), jpeg(), jpeg()], removeIds: [] }, today);
    expect(result.ok).toBe(true);
    expect(m.visits[0].photos.map((p) => p.sortOrder)).toEqual([0, 1, 2]);
    expect(m.stored.size).toBe(3);
  });

  it("LOT1: refuses a 4th photo and does not save anything", async () => {
    const m = memory();
    expect(await saveVisit(m.deps, clientA, null, {}, { add: [jpeg(), jpeg(), jpeg(), jpeg()], removeIds: [] }, today)).toEqual({
      ok: false,
      errors: { photos: "tooManyPhotos" },
    });
    expect(m.visits).toHaveLength(0);
  });

  it("LOT1: removing a photo frees a place and deletes the file", async () => {
    const m = memory();
    const { id: vid } = (await saveVisit(m.deps, clientA, null, {}, { add: [jpeg(), jpeg(), jpeg()], removeIds: [] }, today)) as { id: string };
    const [first] = m.visits[0].photos;
    const result = await saveVisit(m.deps, clientA, vid, {}, { add: [jpeg()], removeIds: [first.id] }, today);
    expect(result.ok).toBe(true);
    expect(m.visits[0].photos).toHaveLength(3);
    expect(m.stored.has(first.storagePath)).toBe(false);
    expect(m.visits[0].photos.at(-1)!.sortOrder).toBe(3);
  });

  it("LOT1: rejects photos that were not compressed to a JPEG", async () => {
    const m = memory();
    expect(await saveVisit(m.deps, clientA, null, {}, { add: [{ ...jpeg(), type: "image/heic" }], removeIds: [] }, today)).toEqual({
      ok: false,
      errors: { photos: "photoInvalid" },
    });
  });

  it("VS1: deleting a visit also deletes its photos from storage", async () => {
    const m = memory();
    const { id: vid } = (await saveVisit(m.deps, clientA, null, {}, { add: [jpeg()], removeIds: [] }, today)) as { id: string };
    expect(await deleteVisit(m.deps, clientA, vid)).toBe(true);
    expect(m.stored.size).toBe(0);
  });
});

describe("R2/P5/AL1: заметки, рекомендации, предупреждение", () => {
  it("R2/P5: saves internal notes and the edited advice", async () => {
    const m = memory();
    await saveVisit(m.deps, clientA, null, { notes: "Синяк справа", recommendations: "Не лягати 4 години.\nСвій совет", recommendationsLang: "uk" }, noPhotos, today);
    expect(m.visits[0]).toMatchObject({ notes: "Синяк справа", recommendations: "Не лягати 4 години.\nСвій совет", recommendationsLang: "uk" });
  });

  it("P5/AL1: the form gets the client's language, allergies and each preparation's effective advice", async () => {
    const m = memory();
    const data = (await getVisitFormData(m.deps, clientA, null))!;
    expect(data.language).toBe("uk");
    expect(data.alerts).toEqual([{ field: "allergies", text: "Лидокаин" }]);
    expect(data.preparations.map((p) => [p.name, p.favorite])).toEqual([["Botox", true], ["Миндальный пилинг 40%", false]]);
    expect(data.preparations[0]).toMatchObject({ doseText: "10–150", doseUnit: "ед.", advice: { uk: "Не лягати 4 години." } });
    expect(data.preparations[1].advice).toEqual({ ru: "Шелушение не удалять." });
  });

  it("P5: remembers that the doctor edited the advice herself", async () => {
    const m = memory();
    await saveVisit(m.deps, clientA, null, { recommendations: "Свій совет", recommendationsEdited: "1" }, noPhotos, today);
    await saveVisit(m.deps, clientA, null, { recommendations: "Не лягати 4 години." }, noPhotos, today);
    expect(m.visits.map((v) => v.recommendationsEdited)).toEqual([true, false]);
  });

  it("PO1: preparations the client has had come first and are marked", async () => {
    const m = memory();
    await saveVisit(m.deps, clientA, null, { items: [{ preparationId: almond }] }, noPhotos, today);
    const data = (await getVisitFormData(m.deps, clientA, null))!;
    expect(data.preparations.map((p) => [p.name, p.usedBefore])).toEqual([["Миндальный пилинг 40%", true], ["Botox", false]]);
    const other = (await getVisitFormData(m.deps, clientB, null))!;
    expect(other.preparations.map((p) => p.name)).toEqual(["Botox", "Миндальный пилинг 40%"]);
  });

  it("VS1: a visit can only be edited through its own client", async () => {
    const m = memory();
    const { id: vid } = (await saveVisit(m.deps, clientA, null, {}, noPhotos, today)) as { id: string };
    expect(await saveVisit(m.deps, clientB, vid, {}, noPhotos, today)).toEqual({ ok: false, notFound: true });
    expect(await getVisitFormData(m.deps, clientB, vid)).toBeNull();
    expect(await deleteVisit(m.deps, clientB, vid)).toBe(false);
  });
});

describe("RV1: повторить прошлый визит", () => {
  it("RV1: the new visit form gets the last visit that took place, not a planned one", async () => {
    const m = memory();
    await saveVisit(m.deps, clientA, null, { visitDate: "2026-10-01", items: [{ preparationId: botox, quantity: "20+15 ед." }] }, noPhotos, today);
    await saveVisit(m.deps, clientA, null, { visitDate: "2026-11-15" }, noPhotos, today);
    const data = (await getVisitFormData(m.deps, clientA, null, { today }))!;
    expect(data.repeatFrom?.visitDate).toBe("2026-10-01");
    expect(data.repeatFrom?.items.map((i) => [i.preparationName, i.quantity])).toEqual([["Botox", "20+15 ед."]]);
    expect((await getVisitFormData(m.deps, clientA, null))!.repeatFrom).toBeNull();
  });
});

describe("Z5: схема лица в визите", () => {
  const scheme = { template: "front", strokes: [{ color: "red", width: 0.006, points: [[0.4, 0.3]] }] };

  it("Z5: the visit keeps the scheme; an empty one is not saved", async () => {
    const m = memory();
    await saveVisit(m.deps, clientA, null, { faceScheme: JSON.stringify(scheme) }, noPhotos, today);
    await saveVisit(m.deps, clientA, null, { faceScheme: JSON.stringify({ template: "front", strokes: [] }) }, noPhotos, today);
    expect(m.visits.map((v) => v.faceScheme)).toEqual([scheme, null]);
  });

  it("Z5/RV1: «Повторить прошлый визит» starts from the last visit's scheme", async () => {
    const m = memory();
    await saveVisit(m.deps, clientA, null, { visitDate: "2026-10-01", items: [{ preparationId: botox }], faceScheme: JSON.stringify(scheme) }, noPhotos, today);
    expect((await getVisitFormData(m.deps, clientA, null, { today }))!.repeatFrom?.faceScheme).toEqual(scheme);
  });

  it("Z5: the visit form hides «Схема лица» for a client marked only «Дерматология»", async () => {
    const m = memory();
    expect((await getVisitFormData(m.deps, clientA, null))!.showFaceScheme).toBe(true);
    m.clients[0].direction = ["dermatology"];
    expect((await getVisitFormData(m.deps, clientA, null))!.showFaceScheme).toBe(false);
    m.clients[0].direction = ["cosmetology", "dermatology"];
    expect((await getVisitFormData(m.deps, clientA, null))!.showFaceScheme).toBe(true);
  });
});

describe("AN3: анамнез без изменений", () => {
  it("AN3: ticking «Анамнез без изменений ✓» stores the visit date on the client", async () => {
    const m = memory();
    await saveVisit(m.deps, clientA, null, { visitDate: "2026-10-20", anamnesisConfirmed: "1" }, noPhotos, today);
    expect(m.clients.find((c) => c.id === clientA)!.anamnesisConfirmedAt).toBe("2026-10-20");
    await saveVisit(m.deps, clientA, null, { visitDate: "2026-09-01", anamnesisConfirmed: "1" }, noPhotos, today);
    expect(m.clients.find((c) => c.id === clientA)!.anamnesisConfirmedAt).toBe("2026-10-20");
    await saveVisit(m.deps, clientB, null, { visitDate: "2026-10-20" }, noPhotos, today);
    expect(m.clients.find((c) => c.id === clientB)!.anamnesisConfirmedAt).toBeNull();
  });
});

describe("H1: история визитов", () => {
  it("H1: the card gets the visits with thumbnails of their sticker photos", async () => {
    const m = memory();
    await saveVisit(m.deps, clientA, null, { items: [{ preparationId: botox }] }, { add: [jpeg(), jpeg()], removeIds: [] }, today);
    const { visits, photoUrls } = await listVisitsForCard(m.deps, clientA);
    expect(visits[0].photos).toHaveLength(2);
    expect(Object.keys(photoUrls)).toEqual(visits[0].photos.map((p) => p.storagePath));
  });

  it("H1: lists the client's visits newest first; the client list shows the last visit", async () => {
    const m = memory();
    await saveVisit(m.deps, clientA, null, { visitDate: "2026-03-01", items: [{ preparationId: botox }] }, noPhotos, today);
    await saveVisit(m.deps, clientA, null, { visitDate: "2026-10-01", items: [{ preparationId: almond }] }, noPhotos, today);
    expect((await listVisits(m.deps.visits, clientA)).map((v) => v.items[0].preparationName)).toEqual(["Миндальный пилинг 40%", "Botox"]);
    expect((await listClients(m.deps.clients, today)).map((c) => [c.fullName, c.date])).toEqual([
      ["Анна Выдуманная", "2026-10-01"],
      ["Вера Примерная", "2025-06-01"],
    ]);
  });
});
