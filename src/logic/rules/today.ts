import type { OpenReminder } from "./reminders";

/** TD1: what «Сегодня» needs to know about a client. */
export type TodayClient = { dueReminders: readonly OpenReminder[]; agenda: "today" | "tomorrow" | null; birthday: boolean };

/** TD1: the client waits for something today – «⏰ Пора», an appointment today or her birthday. */
export function waitsToday(client: TodayClient): boolean {
  return client.dueReminders.length > 0 || client.agenda === "today" || client.birthday;
}

/** TD1: the number on the tab «Сегодня ③» – clients, each counted once (tomorrow is not counted). */
export function todayCount(clients: readonly TodayClient[]): number {
  return clients.filter(waitsToday).length;
}
