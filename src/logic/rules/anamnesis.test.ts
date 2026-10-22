import { describe, expect, it } from "vitest";
import { fieldText, isFieldEmpty, parseAnamnesisForm, sectionHasContent } from "./anamnesis";
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
