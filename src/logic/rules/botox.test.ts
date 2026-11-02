import { describe, expect, it } from "vitest";
import { lastBotoxDate, timeSince } from "./botox";

describe("BO1: сколько времени прошло после ботокса", () => {
  it("BO1: the last injection that has taken place – planned ones do not count", () => {
    expect(lastBotoxDate(["2026-03-01", "2026-09-15", "2026-12-01"], "2026-11-02")).toBe("2026-09-15");
    expect(lastBotoxDate(["2026-12-01"], "2026-11-02")).toBeNull();
    expect(lastBotoxDate([], "2026-11-02")).toBeNull();
  });

  it("BO1: under 2 weeks in days, under a month in weeks", () => {
    expect(timeSince("2026-11-02", "2026-11-02")).toEqual({ unit: "days", days: 0 });
    expect(timeSince("2026-10-24", "2026-11-02")).toEqual({ unit: "days", days: 9 });
    expect(timeSince("2026-10-10", "2026-11-02")).toEqual({ unit: "weeks", weeks: 3 });
  });

  it("BO1: then months and weeks – «1 мес. 2 нед.», «3 мес.»", () => {
    expect(timeSince("2026-09-15", "2026-11-02")).toEqual({ unit: "months", months: 1, weeks: 2 });
    expect(timeSince("2026-08-02", "2026-11-02")).toEqual({ unit: "months", months: 3, weeks: 0 });
    expect(timeSince("2026-07-17", "2026-11-02")).toEqual({ unit: "months", months: 3, weeks: 2 });
  });

  it("BO1: month ends are counted as calendar months", () => {
    expect(timeSince("2026-01-31", "2026-02-28")).toEqual({ unit: "months", months: 1, weeks: 0 });
    expect(timeSince("2025-11-02", "2026-11-02")).toEqual({ unit: "months", months: 12, weeks: 0 });
  });
});
