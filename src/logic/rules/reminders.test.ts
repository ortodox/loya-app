import { describe, expect, it } from "vitest";
import { dueByType, keptReminderDone, parseReminder, reminderChoiceFor, reminderDate, reminderStatus, uniqueTypes } from "./reminders";

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

  it("N7: «⏰ Пора» from the reminder day, each reminder on its own, and the next one still to come", () => {
    const r = (visitId: string, remindOn: string) => ({ visitId, remindOn, types: [] });
    expect(reminderStatus([], "2026-11-02")).toEqual({ due: [], next: null });
    expect(reminderStatus([r("c", "2026-11-20"), r("b", "2026-11-02"), r("a", "2026-10-30")], "2026-11-02")).toEqual({
      due: [r("a", "2026-10-30"), r("b", "2026-11-02")],
      next: "2026-11-20",
    });
    expect(reminderStatus([r("a", "2026-11-03")], "2026-11-02")).toEqual({ due: [], next: "2026-11-03" });
  });

  it("N7: «Готово» stays only while the reminder date is unchanged", () => {
    const done = { remindOn: "2026-11-20", reminderDoneAt: "2026-11-20T10:00:00Z" };
    expect(keptReminderDone(done, "2026-11-20")).toBe("2026-11-20T10:00:00Z");
    expect(keptReminderDone(done, "2026-12-20")).toBeNull();
    expect(keptReminderDone(done, null)).toBeNull();
    expect(keptReminderDone(null, "2026-11-20")).toBeNull();
  });
});

describe("N7 ✏️: «⏰ Пора» по типу процедуры", () => {
  const botox = { id: "t1", code: "BT-01", name: { ru: "Ботулинотерапия" } };
  const bio = { id: "t3", code: "BT-03", name: { ru: "Биоревитализация / ремоделирование" } };
  const own = { id: "t9", code: null, name: { ru: "Авторская маска" } };
  const due = (visitId: string, ...types: (typeof botox | typeof own)[]) => ({ visitId, remindOn: "2026-11-01", types });

  it("N7 ✏️: groups by procedure type – botox first, a client once per type, no preparations last", () => {
    const groups = dueByType([
      { id: "anna", dueReminders: [due("v1", bio), due("v2", botox)] },
      { id: "vera", dueReminders: [due("v3", botox, botox)] },
      { id: "olga", dueReminders: [due("v4"), due("v5", own)] },
    ]);
    expect(groups.map((g) => [g.type?.id ?? null, g.clients.map((c) => c.id)])).toEqual([
      ["t1", ["anna", "vera"]],
      ["t3", ["anna"]],
      ["t9", ["olga"]],
      [null, ["olga"]],
    ]);
  });

  it("N7 ✏️: a type once per visit, even with several preparations of it", () => {
    expect(uniqueTypes([botox, bio, botox]).map((t) => t.id)).toEqual(["t1", "t3"]);
  });
});
