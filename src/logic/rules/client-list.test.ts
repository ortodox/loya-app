import { describe, expect, it } from "vitest";
import { lastActivityDate, matchesClient, matchesName, notesExcerpt, sortNewestFirst, visitTimeline } from "./client-list";

const row = (name: string, cardDate: string, lastVisitDate: string | null, updatedAt = "t0") => ({
  name,
  cardDate,
  lastVisitDate,
  updatedAt,
});

describe("PR2: client list", () => {
  it("PR2: shows the last visit date, or the registration date without visits", () => {
    expect(lastActivityDate(row("a", "2026-01-10", "2026-09-01"))).toBe("2026-09-01");
    expect(lastActivityDate(row("a", "2026-01-10", null))).toBe("2026-01-10");
  });

  it("PR2: lists the newest first", () => {
    const sorted = sortNewestFirst([
      row("old", "2025-01-01", null),
      row("visited", "2024-01-01", "2026-10-01"),
      row("new", "2026-05-01", null),
    ]);
    expect(sorted.map((c) => c.name)).toEqual(["visited", "new", "old"]);
  });

  it("PR2: breaks ties by the most recent edit", () => {
    const sorted = sortNewestFirst([
      row("a", "2026-05-01", null, "2026-05-01T10:00:00Z"),
      row("b", "2026-05-01", null, "2026-05-01T12:00:00Z"),
    ]);
    expect(sorted.map((c) => c.name)).toEqual(["b", "a"]);
  });

  it("PR2: searches names case-insensitively with ё = е and in any word order", () => {
    expect(matchesName("Алёна Тестова", "алена")).toBe(true);
    expect(matchesName("Алёна Тестова", "тест ал")).toBe(true);
    expect(matchesName("Алёна Тестова", "мария")).toBe(false);
    expect(matchesName("Алёна Тестова", "  ")).toBe(true);
  });

  it("PR2: uses the first non-empty notes line as the excerpt", () => {
    expect(notesExcerpt("\n  Сухая кожа, SPF\nвторая строка")).toBe("Сухая кожа, SPF");
    expect(notesExcerpt(null)).toBe("");
    expect(notesExcerpt("a".repeat(100), 10)).toBe("aaaaaaaaa…");
  });
});

describe("PR7: поиск по телефону", () => {
  const anna = { fullName: "Анна Выдуманная", phone: "+48 600-123-456" };

  it("PR7: finds a client by phone number regardless of spaces, + and dashes", () => {
    expect(matchesClient(anna, "600 123")).toBe(true);
    expect(matchesClient(anna, "+48600123456")).toBe(true);
    expect(matchesClient(anna, "48 600 123 456")).toBe(true);
    expect(matchesClient(anna, "700")).toBe(false);
  });

  it("PR7: still searches by name when letters are typed", () => {
    expect(matchesClient(anna, "анна")).toBe(true);
    expect(matchesClient({ fullName: "Анна", phone: null }, "600")).toBe(false);
  });
});

describe("VP2: запись на будущую дату", () => {
  it("VP2: splits visit dates into the last one that took place and the next planned one", () => {
    expect(visitTimeline(["2026-09-01", "2026-11-05", "2026-10-28", "2026-10-31"], "2026-10-28")).toEqual({
      last: "2026-10-28",
      next: "2026-10-31",
    });
    expect(visitTimeline([], "2026-10-28")).toEqual({ last: null, next: null });
  });
});
