import { describe, expect, it } from "vitest";
import { emptySettings, type Preparation, type PreparationInput, type ProcedureType, type ProcedureTypeInput, type Zone } from "@/logic/catalog";
import { DuplicateNameError, type CatalogRepository } from "@/data/repositories/catalog";
import { getCatalogOverview, getPreparationDetail, getTypeDetail, savePreparation, saveType } from "./catalog";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const peelId = id(1);
const collagenId = id(2);
const lipsZone = id(50);

function memory(): CatalogRepository & { types: ProcedureType[]; preparations: Preparation[] } {
  let next = 100;
  const zones: Zone[] = [{ id: lipsZone, code: "lips", name: { ru: "Губы" }, group: "lower", sortOrder: 10 }];
  const types: ProcedureType[] = [
    {
      ...emptySettings,
      id: peelId,
      code: "BT-07",
      name: { ru: "Химический пилинг" },
      sortOrder: 70,
      zoneIds: [lipsZone],
      doseText: "1–4",
      doseUnit: "слоя",
      courseMin: 4,
      courseMax: 6,
      intervalMin: 1,
      intervalMax: 1,
      intervalUnit: "weeks",
      maintenanceAsNeeded: true,
      controlAfterDays: 0,
      advice: { ru: "SPF 50" },
    },
    { ...emptySettings, id: collagenId, code: "BT-10", name: { ru: "Коллагеностимуляция" }, sortOrder: 100, zoneIds: [] },
  ];
  const preparations: Preparation[] = [
    { ...emptySettings, id: id(10), procedureTypeId: peelId, name: "PRX-T33", manufacturer: null, favorite: false },
    {
      ...emptySettings,
      id: id(11),
      procedureTypeId: peelId,
      name: "Миндальный пилинг 40%",
      manufacturer: null,
      favorite: false,
      courseMin: 6,
      courseMax: 8,
      intervalMin: 7,
      intervalMax: 10,
      intervalUnit: "days",
      advice: { ru: "Шелушение не удалять механически." },
    },
    { ...emptySettings, id: id(12), procedureTypeId: peelId, name: "Mediderma", manufacturer: null, favorite: true },
    { ...emptySettings, id: id(13), procedureTypeId: collagenId, name: "Sculptra", manufacturer: null, favorite: false },
  ];
  const typeFrom = (tid: string, input: ProcedureTypeInput, base?: ProcedureType): ProcedureType => ({
    ...input,
    id: tid,
    code: base?.code ?? null,
    sortOrder: base?.sortOrder ?? 1000,
  });
  const prepFrom = (pid: string, input: PreparationInput): Preparation => ({ ...input, id: pid });
  return {
    types,
    preparations,
    listZones: async () => zones,
    listTypes: async () => types,
    getType: async (tid) => types.find((t) => t.id === tid) ?? null,
    createType: async (input) => {
      const tid = id(next++);
      types.push(typeFrom(tid, input));
      return { id: tid };
    },
    updateType: async (tid, input) => {
      const i = types.findIndex((t) => t.id === tid);
      if (i < 0) return false;
      types[i] = typeFrom(tid, input, types[i]);
      return true;
    },
    listPreparations: async () => preparations,
    getPreparation: async (pid) => preparations.find((p) => p.id === pid) ?? null,
    createPreparation: async (input) => {
      if (preparations.some((p) => p.procedureTypeId === input.procedureTypeId && p.name === input.name)) {
        throw new DuplicateNameError("duplicate");
      }
      const pid = id(next++);
      preparations.push(prepFrom(pid, input));
      return { id: pid };
    },
    updatePreparation: async (pid, input) => {
      const i = preparations.findIndex((p) => p.id === pid);
      if (i < 0) return false;
      preparations[i] = prepFrom(pid, input);
      return true;
    },
  };
}

describe("B1: типы процедур", () => {
  it("B1: lists types with their number of preparations and what is still «заполнить»", async () => {
    const overview = await getCatalogOverview(memory());
    expect(overview.types.map((t) => [t.type.name.ru, t.preparationCount, t.missing.length])).toEqual([
      ["Химический пилинг", 3, 0],
      ["Коллагеностимуляция", 1, 7],
    ]);
  });

  it("B1: adds a new type and edits it; unknown zones are dropped", async () => {
    const repo = memory();
    const created = await saveType(repo, null, { name: { ru: "Новый тип" }, zoneIds: [lipsZone, id(99)] });
    expect(created.ok).toBe(true);
    const newId = (created as { id: string }).id;
    expect(repo.types.at(-1)).toMatchObject({ name: { ru: "Новый тип" }, zoneIds: [lipsZone] });
    await saveType(repo, newId, { name: { ru: "Новый тип" }, courseMin: "2", controlMode: "none" });
    expect(repo.types.at(-1)).toMatchObject({ courseMin: 2, courseMax: 2, controlAfterDays: 0, zoneIds: [] });
  });

  it("B1: reports a missing type", async () => {
    expect(await getTypeDetail(memory(), id(77))).toBeNull();
    expect(await saveType(memory(), id(77), { name: { ru: "X" } })).toEqual({ ok: false, notFound: true });
  });
});

describe("P1/P2: препараты", () => {
  it("P1: shows the type's preparations with favourites first, then in Russian alphabetical order", async () => {
    const detail = await getTypeDetail(memory(), peelId);
    // Russian collation puts Cyrillic names before Latin ones.
    expect(detail?.preparations.map((p) => p.name)).toEqual(["Mediderma", "Миндальный пилинг 40%", "PRX-T33"]);
  });

  it("P1/P2: adds a preparation to a type and rejects a duplicate name in the same type", async () => {
    const repo = memory();
    const result = await savePreparation(repo, null, { name: "BioRePeelCl3", procedureTypeId: peelId });
    expect(result.ok).toBe(true);
    expect(await savePreparation(repo, null, { name: "PRX-T33", procedureTypeId: peelId })).toEqual({
      ok: false,
      errors: { name: "duplicate" },
    });
  });

  it("P2: a preparation must belong to an existing type", async () => {
    expect(await savePreparation(memory(), null, { name: "X", procedureTypeId: id(77) })).toEqual({
      ok: false,
      errors: { procedureTypeId: "required" },
    });
  });
});

describe("P3/P5: значения препарата", () => {
  it("P3/P5: «Миндальный пилинг 40%» shows its own course, interval and advice, the rest from BT-07", async () => {
    const detail = await getPreparationDetail(memory(), id(11));
    expect(detail?.effective.settings).toMatchObject({
      courseMin: 6,
      courseMax: 8,
      intervalUnit: "days",
      doseText: "1–4",
      maintenanceAsNeeded: true,
      advice: { ru: "Шелушение не удалять механически." },
    });
    expect(detail?.effective.source.dose).toBe("type");
    expect(detail?.effective.source.course).toBe("preparation");
  });

  it("P3/P5: a preparation of Коллагеностимуляция inherits «заполнить» from its type", async () => {
    const detail = await getPreparationDetail(memory(), id(13));
    expect(detail?.missing).toContain("advice");
  });

  it("P3: clearing an own value makes the preparation inherit again", async () => {
    const repo = memory();
    await savePreparation(repo, id(11), { name: "Миндальный пилинг 40%", procedureTypeId: peelId });
    const detail = await getPreparationDetail(repo, id(11));
    expect(detail?.effective.settings.courseMin).toBe(4);
    expect(Object.values(detail!.effective.source).every((s) => s === "type")).toBe(true);
  });
});
