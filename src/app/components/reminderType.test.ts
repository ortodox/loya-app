import { describe, expect, it } from "vitest";
import { reminderTypeLabel, reminderTypesText } from "./reminderType";

const t = (key: "botox" | "procedure") => ({ botox: "Ботокс", procedure: "Процедура" })[key];
const botox = { id: "t1", code: "BT-01", name: { ru: "Ботулинотерапия" } };
const bio = { id: "t3", code: "BT-03", name: { ru: "Биоревитализация / ремоделирование", pl: "Biorewitalizacja / remodelowanie" } };

describe("N7 ✏️: название процедуры в «⏰ Пора»", () => {
  it("N7 ✏️: «Ботокс» for botulinum therapy, the type's name otherwise, «Процедура» without preparations", () => {
    expect(reminderTypeLabel(t, botox, "ru")).toBe("Ботокс");
    expect(reminderTypeLabel(t, bio, "pl")).toBe("Biorewitalizacja / remodelowanie");
    expect(reminderTypeLabel(t, null, "ru")).toBe("Процедура");
  });

  it("N7 ✏️: the row names every procedure that is due, each once", () => {
    const r = (types: (typeof botox)[]) => ({ visitId: "v", remindOn: "2026-11-01", types });
    expect(reminderTypesText(t, [r([botox, bio]), r([botox]), r([])], "ru")).toBe("Ботокс, Биоревитализация / ремоделирование, Процедура");
  });
});
