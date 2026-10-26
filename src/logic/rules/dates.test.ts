import { describe, expect, it } from "vitest";
import { addDays, addMonths, daysBetween, formatDayMonth, formatIsoDate, isIsoDate, todayIn, wholeYearsBetween } from "./dates";

describe("dates", () => {
  it("accepts only real calendar dates", () => {
    expect(isIsoDate("2026-10-22")).toBe(true);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("22.10.2026")).toBe(false);
  });

  it("counts whole years", () => {
    expect(wholeYearsBetween("2020-05-10", "2026-05-09")).toBe(5);
    expect(wholeYearsBetween("2020-05-10", "2026-05-10")).toBe(6);
  });

  it("uses the practice time zone for today", () => {
    // 23:30 UTC on 22 Oct is already 23 Oct in Warsaw (UTC+2 in summer time).
    expect(todayIn("Europe/Warsaw", new Date("2026-10-22T23:30:00Z"))).toBe("2026-10-23");
  });
});

describe("date format", () => {
  it("shows dates as DD.MM.YYYY", () => {
    expect(formatIsoDate("2026-03-05")).toBe("05.03.2026");
    expect(formatIsoDate("not a date")).toBe("not a date");
  });
});

describe("VP2: дата записи в списке", () => {
  it("VP2: formats the next appointment as DD.MM", () => {
    expect(formatDayMonth("2026-10-31")).toBe("31.10");
    expect(formatDayMonth("2027-01-05")).toBe("05.01");
  });
});

describe("LE2: даты курса", () => {
  it("LE2: counts days and adds days and months", () => {
    expect(daysBetween("2026-10-28", "2026-11-27")).toBe(30);
    expect(daysBetween("2026-11-27", "2026-10-28")).toBe(-30);
    expect(addDays("2026-12-25", 10)).toBe("2027-01-04");
    expect(addMonths("2026-03-31", 1)).toBe("2026-04-30");
  });
});
