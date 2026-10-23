import { describe, expect, it } from "vitest";
import { lastActivityDate } from "./client-list";
import { parseVisitForm, sortVisitsNewestFirst } from "./visits";

const today = "2026-10-23";

describe("VS1: визиты", () => {
  it("VS1: sorts visits newest first", () => {
    const visits = [
      { id: "a", visitDate: "2026-03-01", createdAt: "2026-03-01T10:00:00Z" },
      { id: "b", visitDate: "2026-10-01", createdAt: "2026-10-01T10:00:00Z" },
      { id: "c", visitDate: "2025-12-24", createdAt: "2025-12-24T10:00:00Z" },
    ];
    expect(sortVisitsNewestFirst(visits).map((v) => v.id)).toEqual(["b", "a", "c"]);
  });

  it("VS1: two visits on the same day: the one written last comes first", () => {
    const visits = [
      { id: "morning", visitDate: today, createdAt: "2026-10-23T08:00:00Z" },
      { id: "evening", visitDate: today, createdAt: "2026-10-23T17:00:00Z" },
    ];
    expect(sortVisitsNewestFirst(visits).map((v) => v.id)).toEqual(["evening", "morning"]);
  });

  it("VS1: a new visit needs nothing but defaults to today", () => {
    expect(parseVisitForm({}, today)).toEqual({
      ok: true,
      input: { visitDate: today, homeCareRecommendations: null, procedurePlan: null },
    });
  });

  it("VS1: keeps multi-line free text as typed", () => {
    const result = parseVisitForm(
      {
        visitDate: "2026-10-01",
        homeCareRecommendations: "SPF 50 утром\nне ходить в баню 2 недели\n\n",
        procedurePlan: "  Биоревитализация через 4 недели ?",
      },
      today,
    );
    expect(result).toEqual({
      ok: true,
      input: {
        visitDate: "2026-10-01",
        homeCareRecommendations: "SPF 50 утром\nне ходить в баню 2 недели",
        procedurePlan: "  Биоревитализация через 4 недели ?",
      },
    });
  });

  it("VS1: treats blank texts as empty and rejects an invalid date", () => {
    expect(parseVisitForm({ homeCareRecommendations: " \n ", procedurePlan: "" }, today)).toMatchObject({
      ok: true,
      input: { homeCareRecommendations: null, procedurePlan: null },
    });
    expect(parseVisitForm({ visitDate: "2026-02-30" }, today)).toEqual({
      ok: false,
      errors: { visitDate: "dateInvalid" },
    });
  });

  it("VS1: the client list shows the last visit date, else the first visit date", () => {
    expect(lastActivityDate({ cardDate: "2024-03-15", lastVisitDate: "2026-10-01" })).toBe("2026-10-01");
    expect(lastActivityDate({ cardDate: "2024-03-15", lastVisitDate: null })).toBe("2024-03-15");
  });
});
