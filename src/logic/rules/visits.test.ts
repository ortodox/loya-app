import { describe, expect, it } from "vitest";
import { lastActivityDate } from "./client-list";
import {
  fitWithin,
  hasArchive,
  isAcceptablePhoto,
  parseVisitForm,
  photosFit,
  sortVisitsNewestFirst,
  usedPreparationIds,
  isPlanned,
  splitVisits,
  lastCompletedVisit,
  anamnesisConfirmation,
} from "./visits";
import type { Visit } from "@/logic/client";

const today = "2026-10-27";
const prep = "00000000-0000-4000-8000-000000000001";
const type = "00000000-0000-4000-8000-000000000002";

describe("VS1: визиты", () => {
  it("VS1: sorts visits newest first, same day by when they were written", () => {
    const visits = [
      { id: "a", visitDate: "2026-03-01", createdAt: "2026-03-01T10:00:00Z" },
      { id: "b", visitDate: "2026-10-01", createdAt: "2026-10-01T08:00:00Z" },
      { id: "c", visitDate: "2026-10-01", createdAt: "2026-10-01T17:00:00Z" },
    ];
    expect(sortVisitsNewestFirst(visits).map((v) => v.id)).toEqual(["c", "b", "a"]);
  });

  it("VS1: a new visit needs nothing but defaults to today", () => {
    expect(parseVisitForm({}, today)).toEqual({
      ok: true,
      input: { visitDate: today, notes: null, recommendations: null, recommendationsLang: null, recommendationsEdited: false, anamnesisConfirmed: false, items: [] },
    });
  });

  it("VS1: rejects an invalid date", () => {
    expect(parseVisitForm({ visitDate: "2026-02-30" }, today)).toEqual({
      ok: false,
      errors: { visitDate: "dateInvalid" },
    });
  });

  it("VS1: the client list shows the last visit date, else the first visit date", () => {
    expect(lastActivityDate({ cardDate: "2024-03-15", lastVisitDate: "2026-10-01" })).toBe("2026-10-01");
    expect(lastActivityDate({ cardDate: "2024-03-15", lastVisitDate: null })).toBe("2024-03-15");
  });

  it("VS1: old visits with home-care advice or a plan are shown as «Архив»", () => {
    expect(hasArchive({ archive: { homeCareRecommendations: "SPF", procedurePlan: null } })).toBe(true);
    expect(hasArchive({ archive: { homeCareRecommendations: "  ", procedurePlan: null } })).toBe(false);
  });
});

describe("R1/DO1: препараты и количество", () => {
  it("R1: takes two or more preparations from the catalogue with a free-text quantity", () => {
    const result = parseVisitForm(
      {
        items: [
          { preparationId: prep, quantity: " 20+15 ед. " },
          { preparationId: type, quantity: "" },
        ],
      },
      today,
    );
    expect(result.ok && result.input.items).toEqual([
      { kind: "catalog", preparationId: prep, quantity: "20+15 ед." },
      { kind: "catalog", preparationId: type, quantity: null },
    ]);
  });

  it("R1: «Добавить вручную» needs a name and a procedure type", () => {
    expect(parseVisitForm({ items: [{ manualName: " Новый филлер ", manualTypeId: type, quantity: "1 мл" }] }, today)).toMatchObject({
      ok: true,
      input: { items: [{ kind: "manual", name: "Новый филлер", procedureTypeId: type, quantity: "1 мл" }] },
    });
    expect(parseVisitForm({ items: [{ manualName: "Новый филлер" }] }, today)).toEqual({
      ok: false,
      errors: { items: "manualTypeRequired" },
    });
    expect(parseVisitForm({ items: [{ manualTypeId: type }] }, today)).toEqual({
      ok: false,
      errors: { items: "manualNameRequired" },
    });
  });

  it("R1: ignores empty rows and rejects malformed ids", () => {
    expect(parseVisitForm({ items: [{}, { quantity: "" }] }, today)).toMatchObject({ ok: true, input: { items: [] } });
    expect(parseVisitForm({ items: [{ preparationId: "x" }] }, today)).toEqual({ ok: false, errors: { items: "itemInvalid" } });
  });
});

describe("R2/P5: заметки и рекомендации", () => {
  it("R2/P5: keeps internal notes and the advice with its language", () => {
    const result = parseVisitForm(
      { notes: "Переносит хорошо\n", recommendations: "SPF 50\nНе посещать сауну", recommendationsLang: "uk" },
      today,
    );
    expect(result.ok && result.input).toMatchObject({
      notes: "Переносит хорошо",
      recommendations: "SPF 50\nНе посещать сауну",
      recommendationsLang: "uk",
    });
    expect(parseVisitForm({ recommendationsLang: "de" }, today)).toMatchObject({ ok: true, input: { recommendationsLang: null } });
  });

  it("P5: remembers that the doctor edited the advice, but not for an empty field", () => {
    expect(parseVisitForm({ recommendations: "Мой совет", recommendationsEdited: "1" }, today)).toMatchObject({
      ok: true,
      input: { recommendationsEdited: true },
    });
    expect(parseVisitForm({ recommendations: " ", recommendationsEdited: "1" }, today)).toMatchObject({
      ok: true,
      input: { recommendationsEdited: false },
    });
    expect(parseVisitForm({ recommendations: "SPF 50" }, today)).toMatchObject({ ok: true, input: { recommendationsEdited: false } });
  });
});

describe("PO1: препараты, которые клиент уже получал", () => {
  it("PO1: lists catalogue preparations from the latest visit back, each once", () => {
    const item = (preparationId: string | null) => ({
      id: "x", preparationId, preparationName: "x", procedureTypeId: null, quantity: null, sortOrder: 0,
    });
    const visits = [
      { visitDate: "2026-09-01", createdAt: "2026-09-01T10:00:00Z", items: [item("a"), item("b")] },
      { visitDate: "2026-10-01", createdAt: "2026-10-01T10:00:00Z", items: [item("b"), item(null), item("c")] },
    ];
    expect(usedPreparationIds(visits)).toEqual(["b", "c", "a"]);
  });
});

describe("LOT1: фото наклейки", () => {
  it("LOT1: at most 3 photos per visit, counting kept and new ones", () => {
    expect(photosFit(0, 0, 3)).toBe(true);
    expect(photosFit(2, 0, 2)).toBe(false);
    expect(photosFit(3, 1, 1)).toBe(true);
  });

  it("LOT1: accepts only compressed JPEGs up to ~1.2 MB", () => {
    expect(isAcceptablePhoto({ type: "image/jpeg", size: 400_000 })).toBe(true);
    expect(isAcceptablePhoto({ type: "image/png", size: 400_000 })).toBe(false);
    expect(isAcceptablePhoto({ type: "image/jpeg", size: 5_000_000 })).toBe(false);
    expect(isAcceptablePhoto({ type: "image/jpeg", size: 0 })).toBe(false);
  });

  it("LOT1: compresses to at most 1600 px on the long side, keeping the aspect ratio", () => {
    expect(fitWithin(4032, 3024)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3024, 4032)).toEqual({ width: 1200, height: 1600 });
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });
});

describe("VP2: запланированные визиты", () => {
  const v = (visitDate: string, n = 0) => ({ visitDate, createdAt: `2026-01-01T00:00:0${n}Z`, items: [] as Visit["items"] });

  it("VP2: a visit after today is planned; today's visit is not", () => {
    expect(isPlanned({ visitDate: "2026-10-29" }, "2026-10-28")).toBe(true);
    expect(isPlanned({ visitDate: "2026-10-28" }, "2026-10-28")).toBe(false);
  });

  it("VP2: upcoming visits soonest first, then the past ones newest first", () => {
    const { upcoming, past } = splitVisits([v("2026-11-20"), v("2026-09-01"), v("2026-10-31"), v("2026-10-28")], "2026-10-28");
    expect(upcoming.map((x) => x.visitDate)).toEqual(["2026-10-31", "2026-11-20"]);
    expect(past.map((x) => x.visitDate)).toEqual(["2026-10-28", "2026-09-01"]);
  });
});

describe("RV1: повторить прошлый визит", () => {
  const item = { id: "i", preparationId: "p", preparationName: "Botox", procedureTypeId: null, quantity: "20 ед.", sortOrder: 0 };
  const v = (visitDate: string, items: Visit["items"]) => ({ visitDate, createdAt: "2026-01-01T00:00:00Z", items });

  it("RV1: repeats the newest visit that took place and has preparations", () => {
    const visits = [v("2026-11-01", [item]), v("2026-10-20", []), v("2026-10-01", [item]), v("2026-09-01", [item])];
    expect(lastCompletedVisit(visits, "2026-10-28")?.visitDate).toBe("2026-10-01");
  });

  it("RV1: nothing to repeat without such a visit", () => {
    expect(lastCompletedVisit([v("2026-11-01", [item])], "2026-10-28")).toBeNull();
  });
});

describe("AN3: анамнез без изменений", () => {
  it("AN3: stores the visit date, never a future date", () => {
    expect(anamnesisConfirmation("2026-10-27", "2026-10-28", null)).toBe("2026-10-27");
    expect(anamnesisConfirmation("2026-11-05", "2026-10-28", null)).toBe("2026-10-28");
  });

  it("AN3: keeps a newer confirmation that is already stored", () => {
    expect(anamnesisConfirmation("2026-09-01", "2026-10-28", "2026-10-01")).toBeNull();
    expect(anamnesisConfirmation("2026-10-28", "2026-10-28", "2026-10-01")).toBe("2026-10-28");
  });
});
