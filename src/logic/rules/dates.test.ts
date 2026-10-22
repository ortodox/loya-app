import { describe, expect, it } from "vitest";
import { isIsoDate, todayIn, wholeYearsBetween } from "./dates";

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
