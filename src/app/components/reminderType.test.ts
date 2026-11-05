import { describe, expect, it } from "vitest";
import ru from "../../../messages/ru.json";
import uk from "../../../messages/uk.json";
import pl from "../../../messages/pl.json";
import en from "../../../messages/en.json";
import { reminderTypeLabel, reminderTypesText, shortTypeCodes } from "./reminderType";

const short = ru.reminders.short as Record<string, string>;
const t = (key: string) => (key === "procedure" ? "Процедура" : short[key.replace("short.", "")]);
const botox = { id: "t1", code: "BT-01", name: { ru: "Ботулинотерапия" } };
const bio = { id: "t3", code: "BT-03", name: { ru: "Биоревитализация / ремоделирование" } };
const own = { id: "t9", code: null, name: { ru: "Авторская маска", pl: "Maska autorska" } };

describe("N7 ✏️: короткие названия процедур в «⏰ Пора»", () => {
  it("N7 ✏️: short names for the standard types, the own name for own types, «Процедура» without preparations", () => {
    expect(reminderTypeLabel(t, botox, "ru")).toBe("Ботокс");
    expect(reminderTypeLabel(t, bio, "ru")).toBe("Биоревитализация");
    expect(reminderTypeLabel(t, own, "pl")).toBe("Maska autorska");
    expect(reminderTypeLabel(t, null, "ru")).toBe("Процедура");
  });

  it("N7 ✏️: the approved Russian short names, and every language has all ten", () => {
    expect(shortTypeCodes.map((c) => short[c])).toEqual([
      "Ботокс", "Филлеры", "Биоревитализация", "Биорепарация", "Мезотерапия", "Экзосомы", "Пилинг", "Чистка", "PRP", "Коллагеностимуляция",
    ]);
    for (const m of [uk, pl, en]) expect(Object.keys(m.reminders.short).sort()).toEqual([...shortTypeCodes].sort());
  });

  it("N7 ✏️: a reminder's procedures, each once", () => {
    const r = (types: (typeof botox)[]) => ({ visitId: "v", remindOn: "2026-11-01", types });
    expect(reminderTypesText(t, [r([botox, bio, botox])], "ru")).toBe("Ботокс, Биоревитализация");
    expect(reminderTypesText(t, [r([])], "ru")).toBe("Процедура");
  });
});
