import { describe, expect, it } from "vitest";
import { todayCount, waitsToday } from "./today";

const reminder = { visitId: "v", remindOn: "2026-11-01", types: [] };
const client = (extra: Partial<{ dueReminders: (typeof reminder)[]; agenda: "today" | "tomorrow" | null; birthday: boolean }>) => ({
  dueReminders: [],
  agenda: null,
  birthday: false,
  ...extra,
});

describe("TD1: вкладка «Сегодня»", () => {
  it("TD1: a client waits today for «⏰ Пора», an appointment today or her birthday – not for tomorrow", () => {
    expect(waitsToday(client({ dueReminders: [reminder] }))).toBe(true);
    expect(waitsToday(client({ agenda: "today" }))).toBe(true);
    expect(waitsToday(client({ birthday: true }))).toBe(true);
    expect(waitsToday(client({ agenda: "tomorrow" }))).toBe(false);
    expect(waitsToday(client({}))).toBe(false);
  });

  it("TD1: the number on the tab counts clients, each once", () => {
    expect(todayCount([client({ dueReminders: [reminder, reminder], birthday: true, agenda: "today" }), client({ birthday: true }), client({ agenda: "tomorrow" })])).toBe(2);
    expect(todayCount([])).toBe(0);
  });
});
