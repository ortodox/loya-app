import { describe, expect, it } from "vitest";
import { botoxUnits, consumption, isMonth, nextMonth, pieces, previousMonth, type ConsumptionVisit } from "./consumption";

const botox = { id: "t1", code: "BT-01", name: { ru: "Ботулинотерапия" } };
const filler = { id: "t2", code: "BT-02", name: { ru: "Контурная пластика (филлеры)" } };
const today = "2026-11-06";
const item = (key: string, type: typeof botox, quantity: string | null = null) => ({ key, name: key, type, quantity });
const visit = (clientId: string, visitDate: string, items: ReturnType<typeof item>[], remindOn: string | null = null): ConsumptionVisit => ({
  clientId,
  visitDate,
  remindOn,
  items,
});

describe("RS1: расход препаратов", () => {
  it("RS1: botox units from the free text, the rest in pieces", () => {
    expect(botoxUnits("20")).toBe(20);
    expect(botoxUnits("20+15 ед.")).toBe(35);
    expect(botoxUnits("12,5")).toBe(12.5);
    expect(botoxUnits("лоб и межбровье")).toBeNull();
    expect(botoxUnits("")).toBeNull();
    expect(pieces(null)).toBe(1);
    expect(pieces("2")).toBe(2);
    expect(pieces("3 шт")).toBe(3);
    expect(pieces("1 мл")).toBe(1);
  });

  it("RS1: months – next, previous and a valid month parameter", () => {
    expect(nextMonth("2026-12")).toBe("2027-01");
    expect(previousMonth("2026-01")).toBe("2025-12");
    expect(isMonth("2026-11")).toBe(true);
    expect(isMonth("2026-13")).toBe(false);
  });

  it("RS1: used in the month – done visits only, by type and preparation, botox without a number counted apart", () => {
    const r = consumption(
      [
        visit("a", "2026-11-02", [item("Botox", botox, "20+15"), item("Juvederm", filler)]),
        visit("b", "2026-11-03", [item("Botox", botox, "25"), item("Juvederm", filler, "2")]),
        visit("c", "2026-11-04", [item("Botox", botox, "лоб")]),
        visit("d", "2026-10-30", [item("Botox", botox, "100")]),
        visit("e", "2026-11-20", [item("Botox", botox, "50")]),
      ],
      "2026-11",
      today,
    );
    expect(r.usedVisits).toBe(3);
    expect(r.used.map((g) => [g.type?.code, g.rows.map((x) => [x.name, x.unit, x.amount, x.unknown])])).toEqual([
      ["BT-01", [["Botox", "units", 60, 1]]],
      ["BT-02", [["Juvederm", "pieces", 3, 0]]],
    ]);
  });

  it("RS1: forecast for next month – planned visits (or the client's last visit) and reminders, a client once", () => {
    const r = consumption(
      [
        visit("a", "2026-10-01", [item("Botox", botox, "40")]),
        visit("a", "2026-12-05", []),
        visit("b", "2026-11-01", [item("Botox", botox, "лоб")], "2026-12-10"),
        visit("b", "2026-08-01", [item("Botox", botox, "30")]),
        visit("c", "2026-11-02", [item("Juvederm", filler)], "2026-12-01"),
        visit("c", "2026-12-15", [item("Juvederm", filler, "2")]),
        visit("d", "2026-11-03", [item("Botox", botox, "20")], "2027-01-10"),
      ],
      "2026-11",
      today,
    );
    expect(r.forecastVisits).toBe(3);
    expect(r.forecast?.map((g) => g.rows.map((x) => [x.name, x.amount, x.unknown]))).toEqual([[["Botox", 70, 0]], [["Juvederm", 2, 0]]]);
  });

  it("RS1: no forecast for past months", () => {
    expect(consumption([visit("a", "2026-10-01", [item("Botox", botox, "40")])], "2026-10", today).forecast).toBeNull();
  });
});
