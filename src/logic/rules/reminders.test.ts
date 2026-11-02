import { describe, expect, it } from "vitest";
import { keptReminderDone, parseReminder, reminderChoiceFor, reminderDate, reminderStatus } from "./reminders";

describe("N7: напомнить через", () => {
  it("N7: 2 and 3 weeks, 1, 3, 4 and 6 months after the visit", () => {
    expect(reminderDate("2026-11-02", "2w")).toBe("2026-11-16");
    expect(reminderDate("2026-11-02", "3w")).toBe("2026-11-23");
    expect(reminderDate("2026-11-02", "1m")).toBe("2026-12-02");
    expect(reminderDate("2026-11-02", "3m")).toBe("2027-02-02");
    expect(reminderDate("2026-11-02", "4m")).toBe("2027-03-02");
    expect(reminderDate("2026-08-31", "6m")).toBe("2027-02-28");
  });

  it("N7: the form gives a date, none, or the doctor's own date after the visit", () => {
    expect(parseReminder({}, "2026-11-02")).toEqual({ ok: true, remindOn: null });
    expect(parseReminder({ remindAfter: "3w" }, "2026-11-02")).toEqual({ ok: true, remindOn: "2026-11-23" });
    expect(parseReminder({ remindAfter: "date", remindOn: "2026-12-24" }, "2026-11-02")).toEqual({ ok: true, remindOn: "2026-12-24" });
    expect(parseReminder({ remindAfter: "date", remindOn: "2026-11-02" }, "2026-11-02")).toEqual({ ok: false });
    expect(parseReminder({ remindAfter: "date", remindOn: "" }, "2026-11-02")).toEqual({ ok: false });
    expect(parseReminder({ remindAfter: "5y" }, "2026-11-02")).toEqual({ ok: false });
  });

  it("N7: an opened visit shows the matching choice", () => {
    expect(reminderChoiceFor("2026-11-02", null)).toBe("");
    expect(reminderChoiceFor("2026-11-02", "2027-03-02")).toBe("4m");
    expect(reminderChoiceFor("2026-11-02", "2026-12-24")).toBe("date");
  });

  it("N7: «⏰ Пора» from the reminder day, and the next one still to come", () => {
    expect(reminderStatus([], "2026-11-02")).toEqual({ due: null, next: null });
    expect(reminderStatus(["2026-11-20", "2026-11-02", "2026-10-30"], "2026-11-02")).toEqual({ due: "2026-10-30", next: "2026-11-20" });
    expect(reminderStatus(["2026-11-03"], "2026-11-02")).toEqual({ due: null, next: "2026-11-03" });
  });

  it("N7: «Готово» stays only while the reminder date is unchanged", () => {
    const done = { remindOn: "2026-11-20", reminderDoneAt: "2026-11-20T10:00:00Z" };
    expect(keptReminderDone(done, "2026-11-20")).toBe("2026-11-20T10:00:00Z");
    expect(keptReminderDone(done, "2026-12-20")).toBeNull();
    expect(keptReminderDone(done, null)).toBeNull();
    expect(keptReminderDone(null, "2026-11-20")).toBeNull();
  });
});
