import { describe, expect, it } from "vitest";
import {
  addInterval,
  courseProgress,
  chosenDirection,
  matchesFilter,
  toggleFilter,
  nextLabDate,
  parseCourseForm,
  parseLastLabDate,
  parseDirection,
  parseIntervalValue,
  splitCourses,
  treatmentStatus,
  withDermatology,
} from "./courses";

const today = "2026-10-28";

describe("DM1: направление", () => {
  it("DM1: keeps known directions in a fixed order", () => {
    expect(parseDirection(["dermatology", "x", "cosmetology", "dermatology"])).toEqual(["cosmetology", "dermatology"]);
    expect(parseDirection(undefined)).toEqual([]);
  });

  it("DM1: a treatment course adds «Дерматология» and keeps «Косметология»", () => {
    expect(withDermatology(["cosmetology"])).toEqual(["cosmetology", "dermatology"]);
    expect(withDermatology(["dermatology"])).toEqual(["dermatology"]);
    expect(withDermatology([])).toEqual(["dermatology"]);
  });

  it("DM1: filters the client list by direction; no filter shows everyone", () => {
    const derm = { direction: ["dermatology"] as const };
    const cosm = { direction: ["cosmetology"] as const };
    const none = { direction: [] as const };
    expect([derm, cosm, none].filter((c) => matchesFilter(c, "cosmetology"))).toEqual([cosm, none]);
    expect([derm, cosm, none].filter((c) => matchesFilter(c, "dermatology"))).toEqual([derm]);
    expect([derm, cosm, none].filter((c) => matchesFilter(c, null))).toHaveLength(3);
  });

  it("DM1: a client without a direction counts as «Косметология» in the filter until one is set", () => {
    const none = { direction: [] as const };
    expect(matchesFilter(none, "cosmetology")).toBe(true);
    expect(matchesFilter(none, "dermatology")).toBe(false);
  });

  it("DM1: the card buttons accept only a known direction", () => {
    expect(chosenDirection("dermatology")).toBe("dermatology");
    expect(chosenDirection("cosmetology")).toBe("cosmetology");
    expect(chosenDirection("other")).toBeNull();
  });

  it("DM1: tapping a direction chooses it, tapping it again clears it", () => {
    expect(toggleFilter(null, "dermatology")).toBe("dermatology");
    expect(toggleFilter("dermatology", "dermatology")).toBeNull();
    expect(toggleFilter("dermatology", "cosmetology")).toBe("cosmetology");
  });
});

describe("LE1: курс лечения", () => {
  it("LE1: diagnosis, prescription, start (today by default) and approximate end", () => {
    expect(parseCourseForm({ diagnosis: " Акне  папуло-пустулёзное ", prescription: "Изотретиноин 20 мг\n", endDate: "2027-03-01" }, today)).toEqual({
      ok: true,
      input: {
        diagnosis: "Акне папуло-пустулёзное",
        prescription: "Изотретиноин 20 мг",
        startDate: today,
        endDate: "2027-03-01",
        labInterval: null,
        lastLabDate: null,
      },
    });
  });

  it("LE1: needs a diagnosis and an end date that is not before the start", () => {
    expect(parseCourseForm({ endDate: "2027-01-01" }, today)).toMatchObject({ ok: false, errors: { diagnosis: "diagnosisRequired" } });
    expect(parseCourseForm({ diagnosis: "Акне" }, today)).toMatchObject({ ok: false, errors: { endDate: "endRequired" } });
    expect(parseCourseForm({ diagnosis: "Акне", startDate: "2026-10-01", endDate: "2026-09-01" }, today)).toMatchObject({
      ok: false,
      errors: { endDate: "endBeforeStart" },
    });
  });
});

describe("LE2: сколько осталось до конца курса", () => {
  const course = { startDate: "2026-10-01", endDate: "2026-12-30" };

  it("LE2: days left and progress", () => {
    const p = courseProgress(course, "2026-11-15");
    expect(p.daysLeft).toBe(45);
    expect(p.fraction).toBeCloseTo(45 / 90);
    expect(p.ended).toBe(false);
  });

  it("LE2: after the end date the course has ended and nothing is left", () => {
    expect(courseProgress(course, "2027-01-02")).toEqual({ daysLeft: 0, fraction: 1, ended: true });
    expect(courseProgress(course, "2026-12-30").ended).toBe(false);
  });

  it("LE2: a course that has not started yet shows no progress", () => {
    expect(courseProgress(course, "2026-09-20").fraction).toBe(0);
  });
});

describe("LE4: на лечении в списке", () => {
  it("LE4: days left of the active course that ends first; finished courses do not count", () => {
    const courses = [
      { status: "active" as const, startDate: "2026-09-01", endDate: "2026-11-27" },
      { status: "active" as const, startDate: "2026-10-01", endDate: "2027-01-01" },
      { status: "completed" as const, startDate: "2026-01-01", endDate: "2026-10-29" },
    ];
    expect(treatmentStatus(courses, today)).toEqual({ daysLeft: 30, ended: false });
    expect(treatmentStatus(courses.slice(2), today)).toBeNull();
  });

  it("LE4: an active course past its end date shows as ended, not as 0 days", () => {
    expect(treatmentStatus([{ status: "active", startDate: "2026-08-20", endDate: "2026-10-20" }], today)).toEqual({
      daysLeft: 0,
      ended: true,
    });
  });
});

describe("LE6: контроль анализов", () => {
  it("LE6: accepts decimals with comma or point", () => {
    expect(parseIntervalValue("2,5")).toBe(2.5);
    expect(parseIntervalValue("6")).toBe(6);
    expect(parseIntervalValue("0")).toBeNull();
    expect(parseIntervalValue("abc")).toBeNull();
  });

  it("LE6: every 2,5 months – calendar months plus 15 days", () => {
    expect(addInterval("2026-09-01", { value: 2.5, unit: "months" })).toBe("2026-11-16");
    expect(addInterval("2026-01-31", { value: 1, unit: "months" })).toBe("2026-02-28");
    expect(addInterval("2026-09-01", { value: 6, unit: "weeks" })).toBe("2026-10-13");
    expect(addInterval("2026-09-01", { value: 10, unit: "days" })).toBe("2026-09-11");
  });

  it("LE6: the next tests are counted from the last ones, or from the start", () => {
    const course = { startDate: "2026-09-01", labInterval: { value: 2.5, unit: "months" as const }, lastLabDate: null };
    expect(nextLabDate(course)).toBe("2026-11-16");
    expect(nextLabDate({ ...course, lastLabDate: "2026-11-20" })).toBe("2027-02-04");
    expect(nextLabDate({ ...course, labInterval: null })).toBeNull();
  });

  it("LE6: lab control is optional, but needs a valid interval when switched on", () => {
    const base = { diagnosis: "Акне", endDate: "2027-03-01" };
    expect(parseCourseForm({ ...base, labEnabled: "1", labValue: "2,5", labUnit: "months" }, today)).toMatchObject({
      ok: true,
      input: { labInterval: { value: 2.5, unit: "months" } },
    });
    expect(parseCourseForm({ ...base, labEnabled: "1", labValue: "", labUnit: "months" }, today)).toMatchObject({
      ok: false,
      errors: { lab: "labIntervalInvalid" },
    });
    expect(parseCourseForm({ ...base, labValue: "2", labUnit: "months", lastLabDate: "2026-10-01" }, today)).toMatchObject({
      ok: true,
      input: { labInterval: null, lastLabDate: null },
    });
  });
});

describe("LE9: завершённые курсы", () => {
  it("LE5/LE9: active courses first by start, completed ones by when they finished", () => {
    const c = (id: string, status: "active" | "completed", startDate: string, completedAt: string | null = null) => ({
      id, status, startDate, endDate: "2026-12-01", completedAt,
    });
    const { active, completed } = splitCourses([
      c("old", "completed", "2025-01-01", "2025-06-01"),
      c("a1", "active", "2026-09-01"),
      c("new", "completed", "2026-01-01", "2026-08-01"),
      c("a2", "active", "2026-10-01"),
    ]);
    expect(active.map((x) => x.id)).toEqual(["a2", "a1"]);
    expect(completed.map((x) => x.id)).toEqual(["new", "old"]);
  });
});

describe("LE6: изменить или очистить дату последних анализов", () => {
  it("LE6: an empty date clears it, so the next tests are counted from the start again", () => {
    expect(parseLastLabDate("", today)).toEqual({ ok: true, date: null });
    const course = { startDate: "2026-09-01", labInterval: { value: 2.5, unit: "months" as const }, lastLabDate: null };
    expect(nextLabDate(course)).toBe("2026-11-16");
  });

  it("LE6: another date can be chosen, but not one in the future", () => {
    expect(parseLastLabDate("2026-10-05", today)).toEqual({ ok: true, date: "2026-10-05" });
    expect(parseLastLabDate("2026-12-01", today)).toEqual({ ok: false });
    expect(parseLastLabDate("05.10.2026", today)).toEqual({ ok: false });
  });
});
