import { describe, expect, it } from "vitest";
import { parseAnamnesisForm } from "./anamnesis";
import { adviceConflicts, safetyAlerts } from "./safety-alert";

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

describe("AL1: предупреждение при записи рекомендаций", () => {
  it("AL1: finds an advice line that mentions a word from the allergy field, named as the doctor wrote it", () => {
    expect(adviceConflicts("SPF ?", "Не ложиться 4 часа.\nКрем SPF 50 ежедневно.")).toEqual([
      { word: "SPF", line: "Крем SPF 50 ежедневно." },
    ]);
  });

  it("AL1: matches inflected forms of longer words, ignoring case", () => {
    expect(adviceConflicts("Лидокаин", "Обезболивание ЛИДОКАИНОМ не повторять.")).toEqual([
      { word: "Лидокаин", line: "Обезболивание ЛИДОКАИНОМ не повторять." },
    ]);
  });

  it("AL1: ignores «нет», question marks and short words", () => {
    expect(adviceConflicts("нет ?", "Нет ограничений.")).toEqual([]);
    expect(adviceConflicts("на D", "Витамин D на ночь.")).toEqual([]);
  });

  it("AL1: is empty when there is no advice or no allergy", () => {
    expect(adviceConflicts("Порошок", "")).toEqual([]);
    expect(adviceConflicts("", "SPF 50")).toEqual([]);
  });
});
