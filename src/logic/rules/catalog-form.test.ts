import { describe, expect, it } from "vitest";
import { emptySettings } from "@/logic/catalog";
import { parsePreparationForm, parseSettingsForm, parseTypeForm, settingsToForm } from "./catalog-form";

const typeId = "00000000-0000-4000-8000-000000000001";

describe("B1: тип процедуры", () => {
  it("B1: needs a Russian name and keeps the other languages", () => {
    const result = parseTypeForm({ name: { ru: " Коллагеностимуляция ", pl: "Stymulacja kolagenu" } });
    expect(result.ok && result.input.name).toEqual({ ru: "Коллагеностимуляция", pl: "Stymulacja kolagenu" });
    expect(parseTypeForm({ name: { en: "Peel" } })).toEqual({ ok: false, errors: { nameRu: "required" } });
  });

  it("B1: an empty type is allowed – every value stays «заполнить»", () => {
    const result = parseTypeForm({ name: { ru: "Новый тип" } });
    expect(result.ok && result.input).toEqual({ ...emptySettings, name: { ru: "Новый тип" }, zoneIds: [] });
  });

  it("B1: keeps allowed zones once each and ignores malformed ids", () => {
    const result = parseTypeForm({ name: { ru: "Тип" }, zoneIds: [typeId, typeId, "x"] });
    expect(result.ok && result.input.zoneIds).toEqual([typeId]);
  });
});

describe("P3: интервалы, курс и контроль", () => {
  it("P3: reads ranges, a single value as «exactly», and units", () => {
    const result = parseSettingsForm({
      courseMin: "3",
      courseMax: "5",
      intervalMin: "2",
      intervalUnit: "weeks",
      maintenanceMin: "4",
      maintenanceMax: "6",
      maintenanceUnit: "months",
    });
    expect(result.ok && result.input).toMatchObject({
      courseMin: 3,
      courseMax: 5,
      intervalMin: 2,
      intervalMax: 2,
      intervalUnit: "weeks",
      maintenanceMin: 4,
      maintenanceMax: 6,
      maintenanceUnit: "months",
    });
  });

  it("P3: rejects min > max, non-numbers and a missing unit", () => {
    expect(parseSettingsForm({ courseMin: "5", courseMax: "3" })).toEqual({
      ok: false,
      errors: { courseMax: "range" },
    });
    expect(parseSettingsForm({ intervalMin: "2.5", intervalUnit: "weeks" })).toEqual({
      ok: false,
      errors: { intervalMin: "number" },
    });
    expect(parseSettingsForm({ intervalMin: "2" })).toEqual({ ok: false, errors: { intervalUnit: "unitRequired" } });
  });

  it("P3: a unit without numbers is ignored", () => {
    expect(parseSettingsForm({ intervalUnit: "weeks" })).toEqual({ ok: true, input: emptySettings });
  });

  it("P3: «по показаниям» and follow-up: none = 0, days = N, empty = not set", () => {
    expect(parseSettingsForm({ maintenanceAsNeeded: "on" })).toMatchObject({
      ok: true,
      input: { maintenanceAsNeeded: true },
    });
    const control = (controlMode: string, controlDays = "") =>
      parseSettingsForm({ controlMode, controlDays });
    expect(control("none")).toMatchObject({ ok: true, input: { controlAfterDays: 0 } });
    expect(control("days", "14")).toMatchObject({ ok: true, input: { controlAfterDays: 14 } });
    expect(control("")).toMatchObject({ ok: true, input: { controlAfterDays: null } });
    expect(control("days")).toEqual({ ok: false, errors: { controlDays: "required" } });
  });
});

describe("P5/S2: рекомендации", () => {
  it("P5: one recommendation per line, blank lines removed", () => {
    const result = parseSettingsForm({ advice: { ru: " SPF 50 \n\nНе посещать сауну 3 дня\n" } });
    expect(result.ok && result.input.advice).toEqual({ ru: "SPF 50\nНе посещать сауну 3 дня" });
  });

  it("S2: keeps «требует проверки» only for languages that have text", () => {
    const result = parseSettingsForm({
      advice: { ru: "SPF 50", uk: "SPF 50", pl: "" },
      adviceReview: ["uk", "pl", "xx"],
    });
    expect(result.ok && result.input).toMatchObject({ advice: { ru: "SPF 50", uk: "SPF 50" }, adviceReview: ["uk"] });
  });

  it("S2: unticking «требует проверки» marks the translation as checked", () => {
    const result = parseSettingsForm({ advice: { ru: "SPF", en: "SPF" }, adviceReview: [] });
    expect(result.ok && result.input.adviceReview).toBeNull();
  });
});

describe("P1/P2: препарат", () => {
  it("P1: needs a name and a procedure type; manufacturer and favourite are optional", () => {
    const result = parsePreparationForm({ name: " Profhilo ", procedureTypeId: typeId, favorite: "on" });
    expect(result.ok && result.input).toEqual({
      ...emptySettings,
      procedureTypeId: typeId,
      name: "Profhilo",
      manufacturer: null,
      favorite: true,
    });
    expect(parsePreparationForm({})).toEqual({
      ok: false,
      errors: { name: "required", procedureTypeId: "required" },
    });
  });

  it("P3: an empty override field means «use the type's value» (null)", () => {
    const result = parsePreparationForm({ name: "X", procedureTypeId: typeId, courseMin: "", doseText: " " });
    expect(result.ok && [result.input.courseMin, result.input.doseText]).toEqual([null, null]);
  });

  it("round-trips settings through the edit form", () => {
    const settings = {
      ...emptySettings,
      courseMin: 6,
      courseMax: 8,
      intervalMin: 7,
      intervalMax: 10,
      intervalUnit: "days" as const,
      controlAfterDays: 0,
      advice: { ru: "a\nb" },
    };
    const back = parseSettingsForm(settingsToForm(settings));
    expect(back).toEqual({ ok: true, input: settings });
  });
});
