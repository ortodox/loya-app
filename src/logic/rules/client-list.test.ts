import { describe, expect, it } from "vitest";
import { lastActivityDate, matchesName, notesExcerpt, sortNewestFirst } from "./client-list";

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
