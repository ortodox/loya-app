import { describe, expect, it } from "vitest";
import { emptySettings, type CatalogSettings } from "@/logic/catalog";
import {
  adviceLines,
  effectivePreparationSettings,
  localized,
  missingSettings,
  needsReview,
} from "./catalog-settings";

// BT-07 Химический пилинг and its exception «Миндальный пилинг 40%», as in preparaty_ru.md §3–4.
const chemicalPeel: CatalogSettings = {
  doseText: "1–4",
  doseUnit: "слоя",
  courseMin: 4,
  courseMax: 6,
  intervalMin: 1,
  intervalMax: 1,
  intervalUnit: "weeks",
  maintenanceMin: null,
  maintenanceMax: null,
  maintenanceUnit: null,
  maintenanceAsNeeded: true,
  controlAfterDays: 0,
  advice: {
    ru: "Не использовать скрабы, кислоты и ретиноиды 3 дня.\nАктивно увлажнять кожу.",
    uk: "Не використовувати скраби, кислоти та ретиноїди 3 дні.\nАктивно зволожувати шкіру.",
  },
  adviceReview: ["uk"],
};

const almondPeel: CatalogSettings = {
  ...emptySettings,
  courseMin: 6,
  courseMax: 8,
  intervalMin: 7,
  intervalMax: 10,
  intervalUnit: "days",
  advice: { ru: "Не использовать скрабы, кислоты и ретиноиды 7 дней.\nШелушение не удалять механически." },
  adviceReview: null,
};

describe("P3/P5: значения препарата наследуются от типа процедуры", () => {
  it("P3/P5: a preparation without own values gets everything from its type", () => {
    const { settings, source } = effectivePreparationSettings(chemicalPeel, emptySettings);
    expect(settings).toEqual(chemicalPeel);
    expect(Object.values(source).every((s) => s === "type")).toBe(true);
  });

  it("P3/P5: an empty field on the preparation inherits the type's value", () => {
    const { settings } = effectivePreparationSettings(chemicalPeel, { ...emptySettings, doseText: "" });
    expect(settings.doseText).toBe("1–4");
    expect(settings.doseUnit).toBe("слоя");
  });

  it("P3: the preparation's own interval wins over the type's", () => {
    const { settings, source } = effectivePreparationSettings(chemicalPeel, {
      ...emptySettings,
      intervalMin: 2,
      intervalMax: 3,
      intervalUnit: "weeks",
    });
    expect([settings.intervalMin, settings.intervalMax, settings.intervalUnit]).toEqual([2, 3, "weeks"]);
    expect(source.interval).toBe("preparation");
    expect(source.course).toBe("type");
  });

  it("P3: a group is taken as a whole – own «2–4» is not mixed with the type's unit", () => {
    const { settings } = effectivePreparationSettings(chemicalPeel, {
      ...emptySettings,
      intervalMin: 2,
      intervalMax: 4,
    });
    expect(settings.intervalUnit).toBeNull();
  });

  it("P5: own advice replaces the type's advice, together with its review flags", () => {
    const { settings, source } = effectivePreparationSettings(chemicalPeel, {
      ...emptySettings,
      advice: { ru: "Свой совет" },
    });
    expect(settings.advice).toEqual({ ru: "Свой совет" });
    expect(settings.adviceReview).toBeNull();
    expect(source.advice).toBe("preparation");
  });

  it("P5: blank advice on the preparation does not hide the type's advice", () => {
    const { settings } = effectivePreparationSettings(chemicalPeel, { ...emptySettings, advice: { ru: "  " } });
    expect(settings.advice).toEqual(chemicalPeel.advice);
  });

  it("P3/P5: «Миндальный пилинг 40%» gets course 6–8, interval 7–10 days and its own advice", () => {
    const { settings, source } = effectivePreparationSettings(chemicalPeel, almondPeel);
    expect(settings).toMatchObject({
      courseMin: 6,
      courseMax: 8,
      intervalMin: 7,
      intervalMax: 10,
      intervalUnit: "days",
      // inherited from BT-07
      doseText: "1–4",
      doseUnit: "слоя",
      maintenanceAsNeeded: true,
      controlAfterDays: 0,
    });
    expect(adviceLines(settings.advice, "ru")).toEqual([
      "Не использовать скрабы, кислоты и ретиноиды 7 дней.",
      "Шелушение не удалять механически.",
    ]);
    expect(source).toEqual({
      dose: "type",
      course: "preparation",
      interval: "preparation",
      maintenance: "type",
      control: "type",
      advice: "preparation",
    });
  });

  it("P3: «no follow-up visit» (0) on the preparation is an own value, not «inherit»", () => {
    const botulinum = { ...chemicalPeel, controlAfterDays: 14 };
    const { settings } = effectivePreparationSettings(botulinum, { ...emptySettings, controlAfterDays: 0 });
    expect(settings.controlAfterDays).toBe(0);
  });
});

describe("B1: что нужно заполнить", () => {
  it("B1: a fully described type has nothing missing", () => {
    expect(missingSettings(chemicalPeel, 4)).toEqual([]);
  });

  it("B1: Коллагеностимуляция (nothing filled in) shows every group as «заполнить»", () => {
    expect(missingSettings(emptySettings, 0)).toEqual([
      "zones",
      "dose",
      "course",
      "interval",
      "maintenance",
      "control",
      "advice",
    ]);
  });

  it("B1: a single-procedure course needs no interval; «по показаниям» counts as maintenance", () => {
    const botulinum = { ...chemicalPeel, courseMin: 1, courseMax: 1, intervalMin: null, intervalMax: null };
    expect(missingSettings(botulinum)).toEqual([]);
  });

  it("B1: a «–» dose counts as filled in", () => {
    expect(missingSettings({ ...chemicalPeel, doseText: "–", doseUnit: null })).toEqual([]);
  });
});

describe("S2: рекомендации на языке клиента", () => {
  it("S2: splits advice into lines and falls back to Russian for names", () => {
    expect(adviceLines(chemicalPeel.advice, "uk")).toHaveLength(2);
    expect(adviceLines(chemicalPeel.advice, "pl")).toEqual([]);
    expect(localized({ ru: "Мезотерапия", pl: "Mezoterapia" }, "pl")).toBe("Mezoterapia");
    expect(localized({ ru: "Мезотерапия" }, "en")).toBe("Мезотерапия");
  });

  it("S2: marks translations «требует проверки» until the doctor has checked them", () => {
    expect(needsReview(chemicalPeel, "uk")).toBe(true);
    expect(needsReview(chemicalPeel, "ru")).toBe(false);
    expect(needsReview({ ...chemicalPeel, adviceReview: ["pl"] }, "pl")).toBe(false); // no Polish text
  });
});

describe("P3: диапазоны", () => {
  it("P3: shows «3–5», a single value, and uses the upper value for plurals", async () => {
    const { rangeText } = await import("./catalog-settings");
    expect(rangeText(3, 5)).toEqual({ range: "3–5", count: 5 });
    expect(rangeText(4, 4)).toEqual({ range: "4", count: 4 });
    expect(rangeText(null, null)).toBeNull();
  });
});
