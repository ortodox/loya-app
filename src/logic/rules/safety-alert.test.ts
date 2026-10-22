import { describe, expect, it } from "vitest";
import { fieldText, safetyAlerts } from "./safety-alert";

describe("AL2: safety alert", () => {
  it("AL2: shows nothing when allergies and medications are empty", () => {
    expect(safetyAlerts({})).toEqual([]);
    expect(safetyAlerts(null)).toEqual([]);
    expect(safetyAlerts({ allergies: "  ", medications: { choices: [], text: "" } })).toEqual([]);
  });

  it("AL2: shows allergies and medications in that order", () => {
    expect(
      safetyAlerts({ medications: "Витамин D", allergies: "Лидокаин", bloodPressure: "120/80" }),
    ).toEqual([
      { field: "allergies", text: "Лидокаин" },
      { field: "medications", text: "Витамин D" },
    ]);
  });

  it("AL2: reads quick choices, free text and uncertainty", () => {
    expect(fieldText({ choices: ["Пыльца"], text: "Порошок", uncertain: true })).toBe(
      "Пыльца, Порошок ?",
    );
    expect(safetyAlerts({ allergies: { text: "Порошок", uncertain: true } })).toEqual([
      { field: "allergies", text: "Порошок ?" },
    ]);
  });
});
