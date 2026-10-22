import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import pl from "../../messages/pl.json";
import ru from "../../messages/ru.json";
import uk from "../../messages/uk.json";
import { alertFields, anamnesisFields, clinicalSections, generalDataFields } from "./kartaTemplate";

const k = ru.karta as {
  sections: Record<string, string>;
  fields: Record<string, string>;
  options: Record<string, Record<string, string>>;
};
const sectionLabels = () => ["generalData", ...clinicalSections.map((s) => s.key)].map((s) => k.sections[s]);
const fieldLabels = (section: string) =>
  clinicalSections.find((s) => s.key === section)!.fields.map((f) => k.fields[f.key]);
const optionLabels = (field: string) =>
  anamnesisFields.find((f) => f.key === field)!.options.map((o) => k.options[field][o]);

// Expected values are copied from CLAUDE.md, «Малая «Карта клиента»».
describe("Карта клиента template (CLAUDE.md)", () => {
  it("PR1/JA1: has the sections in Loya's order, with Жалобы outside Общие данные", () => {
    expect(sectionLabels()).toEqual([
      "Общие данные",
      "Жалобы",
      "Состояние здоровья",
      "Состояние кожи",
      "Возрастные изменения",
      "Ранее проведённые процедуры",
    ]);
    expect(generalDataFields).not.toContain("complaints");
  });

  it("PR1: Общие данные are Дата · Ф.И.О · Возраст · Телефон · E-mail · Место проживания · Язык", () => {
    expect(generalDataFields.map((f) => ru.card.fields[f])).toEqual([
      "Дата",
      "Ф.И.О",
      "Возраст",
      "Телефон",
      "E-mail",
      "Место постоянного проживания",
      "Язык",
    ]);
  });

  it("JA1: Жалобы has the quick choices from the template", () => {
    expect(optionLabels("complaints")).toEqual([
      "тон кожи",
      "покраснение",
      "акне",
      "подкожные воспаления",
      "пигментация",
      "морщины",
      "сухость",
      "расширенные поры",
      "«гусиная кожа»",
    ]);
  });

  it("AN1: Состояние здоровья has the template fields, all free text", () => {
    expect(fieldLabels("health")).toEqual([
      "Артериальное давление",
      "Эндокринная система",
      "Желудочно-кишечный тракт",
      "Сердце и сосуды",
      "Мочеполовая система",
      "Дыхательная система",
      "Травмы и операции",
      "Аллергоанамнез",
      "Принимаемые препараты (БАДы, витамины, лекарства, контрацептивы)",
    ]);
    const health = clinicalSections.find((s) => s.key === "health")!;
    expect(health.fields.every((f) => f.options.length === 0)).toBe(true);
  });

  it("SK1: Состояние кожи has type, features and diseases with quick choices", () => {
    expect(fieldLabels("skin")).toEqual(["Тип кожи", "Особенности кожи", "Болезни кожи"]);
    expect(optionLabels("skinType")).toEqual(["сухая", "жирная", "комбинированная", "нормальная", "чувствительная"]);
    expect(optionLabels("skinFeatures")).toEqual(["пигментация", "шелушения", "высыпания", "рубчики"]);
    expect(optionLabels("skinDiseases")).toEqual(["акне", "купероз", "постакне", "розацеа"]);
  });

  it("VI1: Возрастные изменения has aging types and wrinkle types", () => {
    expect(fieldLabels("aging")).toEqual(["Типы старения кожи", "Виды морщин"]);
    expect(optionLabels("agingType")).toEqual([
      "фотостарение",
      "хроностарение",
      "мышечный",
      "мелкоморщинистый",
      "отёчно-деформационный",
    ]);
    expect(optionLabels("wrinkleTypes")).toEqual(["статические", "динамические", "мимические", "гравитационные"]);
  });

  it("PH1: Ранее проведённые процедуры has salon choices and free-text injections", () => {
    expect(fieldLabels("previousProcedures")).toEqual(["В салоне", "Инъекционные вмешательства"]);
    expect(optionLabels("salon")).toEqual([
      "чистка",
      "пилинг",
      "SMAS",
      "биоревитализация",
      "ботокс",
      "филлеры губ",
      "полимолочная кислота",
    ]);
    expect(anamnesisFields.find((f) => f.key === "injections")!.options).toEqual([]);
  });

  it("AL2: the alert fields are Аллергоанамнез and Принимаемые препараты in Состояние здоровья", () => {
    const health = clinicalSections.find((s) => s.key === "health")!.fields.map((f) => f.key);
    expect(alertFields.every((f) => (health as readonly string[]).includes(f))).toBe(true);
  });

  it("uses unique field keys, since anamnesis is a flat object", () => {
    const keys = anamnesisFields.map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("has a label for every section, field and option in all languages", () => {
    for (const m of [ru, uk, pl, en]) {
      const karta = m.karta as typeof k;
      for (const s of clinicalSections) expect(karta.sections[s.key]).toBeTruthy();
      for (const f of anamnesisFields) {
        expect(karta.fields[f.key]).toBeTruthy();
        for (const o of f.options) expect(karta.options[f.key]?.[o]).toBeTruthy();
      }
    }
  });
});
