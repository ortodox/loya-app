import { describe, expect, it } from "vitest";
import { parseAnamnesisForm } from "./anamnesis";
import { safetyAlerts } from "./safety-alert";

describe("AL2: аллергии и препараты вверху карты", () => {
  it("AL2: shows nothing when allergies and medications are empty", () => {
    expect(safetyAlerts({})).toEqual([]);
    expect(safetyAlerts(null)).toEqual([]);
    expect(safetyAlerts({ allergies: { text: "  " }, bloodPressure: { text: "120/80" } })).toEqual([]);
  });

  it("AL2: reads the real «Аллергоанамнез» and «Принимаемые препараты» fields from the form", () => {
    const anamnesis = parseAnamnesisForm({
      medications: { text: "Витамин D, контрацептивы" },
      allergies: { text: "Порошок ?" },
      bloodPressure: { text: "120/80" },
    });
    expect(safetyAlerts(anamnesis)).toEqual([
      { field: "allergies", text: "Порошок ?" },
      { field: "medications", text: "Витамин D, контрацептивы" },
    ]);
  });

  it("AL2: shows only the field that is filled in", () => {
    expect(safetyAlerts({ medications: { text: "Метформин" } })).toEqual([
      { field: "medications", text: "Метформин" },
    ]);
  });
});
