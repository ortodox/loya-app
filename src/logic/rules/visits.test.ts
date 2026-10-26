import { describe, expect, it } from "vitest";
import { lastActivityDate } from "./client-list";
import {
  fitWithin,
  hasArchive,
  isAcceptablePhoto,
  parseVisitForm,
  photosFit,
  sortVisitsNewestFirst,
} from "./visits";

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
      input: { visitDate: today, notes: null, recommendations: null, recommendationsLang: null, items: [] },
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
