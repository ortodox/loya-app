import { describe, expect, it } from "vitest";
import { fieldText, isFieldEmpty, mergeAnamnesisSection, parseAnamnesisForm, sectionHasContent, sectionPreview } from "./anamnesis";
import { clinicalSections } from "@/config/kartaTemplate";

describe("JA1: жалобы", () => {
  it("JA1: stores ticked quick choices in template order, plus free text", () => {
    const anamnesis = parseAnamnesisForm({
      complaints: { choices: ["dryness", "acne", "notAnOption"], text: "носогубные складки" },
    });
    expect(anamnesis).toEqual({
      complaints: { choices: ["acne", "dryness"], text: "носогубные складки" },
    });
  });
});

describe("AN1: состояние здоровья", () => {
  it("AN1: stores free-text health fields under template keys and leaves empty ones out", () => {
    expect(
      parseAnamnesisForm({
        bloodPressure: { text: " 120/80 " },
        endocrine: { text: "  " },
        allergies: { text: "Лидокаин" },
      }),
    ).toEqual({ bloodPressure: { text: "120/80" }, allergies: { text: "Лидокаин" } });
  });

  it("AN1: ignores quick choices on free-text-only fields", () => {
    expect(parseAnamnesisForm({ medications: { choices: ["x"], text: "" } })).toEqual({});
  });
});

describe("AN2: свободный текст и неуверенность", () => {
  it("AN2: always allows free text, including «?»", () => {
    expect(parseAnamnesisForm({ allergies: { text: "Порошок ?" } })).toEqual({
      allergies: { text: "Порошок ?" },
    });
    expect(parseAnamnesisForm({ skinType: { text: "?" } })).toEqual({
      skinType: { choices: [], text: "?" },
    });
  });

  it("AN2: shows quick choices and free text together", () => {
    const label = (c: string) => ({ dry: "сухая", sensitive: "чувствительная" })[c] ?? c;
    expect(fieldText({ choices: ["dry", "sensitive"], text: "зимой ?" }, label)).toBe(
      "сухая, чувствительная, зимой ?",
    );
    expect(fieldText("старый текст")).toBe("старый текст");
    expect(isFieldEmpty({ choices: [], text: " " })).toBe(true);
  });
});

describe("SK1/VI1/PH1: кожа, возрастные изменения, процедуры", () => {
  it("SK1: stores skin type, features and diseases as separate fields", () => {
    expect(
      parseAnamnesisForm({
        skinType: { choices: ["combination"] },
        skinFeatures: { choices: ["scars"] },
        skinDiseases: { choices: ["rosacea", "couperose"] },
      }),
    ).toEqual({
      skinType: { choices: ["combination"], text: "" },
      skinFeatures: { choices: ["scars"], text: "" },
      skinDiseases: { choices: ["couperose", "rosacea"], text: "" },
    });
  });

  it("VI1: stores aging type and wrinkle types", () => {
    expect(
      parseAnamnesisForm({ agingType: { choices: ["photo"] }, wrinkleTypes: { choices: ["mimic"] } }),
    ).toEqual({
      agingType: { choices: ["photo"], text: "" },
      wrinkleTypes: { choices: ["mimic"], text: "" },
    });
  });

  it("PH1: stores salon procedures and injection history", () => {
    expect(
      parseAnamnesisForm({
        salon: { choices: ["botox", "smas"], text: "2025" },
        injections: { text: "филлер губ ?" },
      }),
    ).toEqual({
      salon: { choices: ["smas", "botox"], text: "2025" },
      injections: { text: "филлер губ ?" },
    });
  });

  it("keeps keys that are not in the template when editing", () => {
    expect(
      parseAnamnesisForm({ allergies: { text: "новое" } }, { allergies: "старое", legacyField: "x" }),
    ).toEqual({ legacyField: "x", allergies: { text: "новое" } });
  });

  it("knows whether a section has content", () => {
    const health = clinicalSections.find((s) => s.key === "health")!;
    expect(sectionHasContent(health.fields, {})).toBe(false);
    expect(sectionHasContent(health.fields, { respiratory: { text: "астма" } })).toBe(true);
  });
});

describe("AN1/SK1: краткое содержание раздела", () => {
  const skin = clinicalSections.find((s) => s.key === "skin")!;
  const health = clinicalSections.find((s) => s.key === "health")!;

  it("SK1: summarises filled fields in template order with labels for quick choices", () => {
    const label = (field: string, c: string) => `${field}:${c}`;
    expect(
      sectionPreview(skin.fields, { skinDiseases: { choices: ["rosacea"] }, skinType: { choices: ["dry"], text: "зимой" } }, label),
    ).toBe("skinType:dry, зимой · skinDiseases:rosacea");
  });

  it("AN1: is empty for an empty section and shortens long text", () => {
    expect(sectionPreview(health.fields, {})).toBe("");
    const long = sectionPreview(health.fields, { bloodPressure: { text: "а".repeat(200) } }, undefined, 20);
    expect(long).toHaveLength(20);
    expect(long.endsWith("…")).toBe(true);
  });

  it("AN2: keeps «?» and flattens line breaks", () => {
    expect(sectionPreview(health.fields, { allergies: { text: "Порошок ?\nпыльца" } })).toBe("Порошок ? пыльца");
  });
});

describe("AN3: изменить один раздел анкеты", () => {
  const previous = {
    complaints: { choices: ["acne"], text: "" },
    medications: { text: "Витамин D" },
    allergies: { text: "Лидокаин" },
    skinType: { choices: ["dry"], text: "" },
    oldKey: { text: "из старого шаблона" },
  };

  it("AN3: only the fields of the chosen section change", () => {
    const next = mergeAnamnesisSection(previous, "health", { medications: { text: "Изотретиноин 20 мг" }, allergies: { text: "Лидокаин" } })!;
    expect(next.medications).toEqual({ text: "Изотретиноин 20 мг" });
    expect(next.allergies).toEqual({ text: "Лидокаин" });
    expect(next.complaints).toEqual(previous.complaints);
    expect(next.skinType).toEqual(previous.skinType);
    expect(next.oldKey).toEqual(previous.oldKey);
  });

  it("AN3: an emptied field in the section is removed, quick choices follow the template", () => {
    const next = mergeAnamnesisSection(previous, "skin", { skinType: { choices: ["oily", "nonsense"] }, skinFeatures: { text: " " } })!;
    expect(next.skinType).toEqual({ choices: ["oily"], text: "" });
    expect("skinFeatures" in next).toBe(false);
    expect(mergeAnamnesisSection(previous, "health", {})!.medications).toBeUndefined();
  });

  it("AN3: an unknown section is refused", () => {
    expect(mergeAnamnesisSection(previous, "generalData", {})).toBeNull();
  });
});
