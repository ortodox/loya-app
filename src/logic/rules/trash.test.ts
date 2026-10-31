import { describe, expect, it } from "vitest";
import { deleteWarnings, isExpired, purgeAt, purgeDate } from "./trash";

describe("PR6: корзина на 30 дней", () => {
  it("PR6: a deleted client is deleted for good 30 days later", () => {
    expect(purgeAt("2026-10-31T10:00:00Z").toISOString()).toBe("2026-11-30T10:00:00.000Z");
    expect(isExpired("2026-10-31T10:00:00Z", new Date("2026-11-30T09:59:59Z"))).toBe(false);
    expect(isExpired("2026-10-31T10:00:00Z", new Date("2026-11-30T10:00:00Z"))).toBe(true);
  });

  it("PR6: the day shown follows the practice's time zone", () => {
    expect(purgeDate("2026-10-31T23:30:00Z", "Europe/Warsaw")).toBe("2026-12-01");
    expect(purgeDate("2026-10-31T10:00:00Z", "Europe/Warsaw")).toBe("2026-11-30");
  });
});

describe("PR6: предупреждение перед удалением", () => {
  const today = "2026-10-31";
  it("PR6: counts planned visits after today and notices an active course", () => {
    const client = {
      visitDates: ["2026-10-01", "2026-10-31", "2026-11-05", "2026-12-01"],
      courses: [{ status: "completed" as const, startDate: "2026-01-01", endDate: "2026-03-01" }, { status: "active" as const, startDate: "2026-09-01", endDate: "2027-02-28" }],
    };
    expect(deleteWarnings(client, today)).toEqual({ plannedVisits: 2, activeCourse: true });
  });

  it("PR6: no warning without planned visits or active course", () => {
    expect(deleteWarnings({ visitDates: ["2026-10-01"], courses: [] }, today)).toEqual({ plannedVisits: 0, activeCourse: false });
  });
});
