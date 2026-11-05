import type { Localized } from "@/logic/catalog";
import type { IsoDate } from "@/logic/client";
import { addDays, addMonths, isIsoDate } from "./dates";

/** N7: «Напомнить через» – the choices in the visit form, counted from the visit date. */
export const reminderPresets = ["2w", "3w", "1m", "3m", "4m", "6m"] as const;
export type ReminderPreset = (typeof reminderPresets)[number];
/** "" = no reminder, "date" = the doctor's own date. */
export type ReminderChoice = ReminderPreset | "date" | "";

const isPreset = (value: string): value is ReminderPreset => (reminderPresets as readonly string[]).includes(value);

/** N7: the day the reminder comes, e.g. 3 weeks or 4 months after the visit. */
export function reminderDate(visitDate: IsoDate, preset: ReminderPreset): IsoDate {
  const n = Number(preset.slice(0, -1));
  return preset.endsWith("w") ? addDays(visitDate, n * 7) : addMonths(visitDate, n);
}

/** N7: which choice to show when a saved visit is opened – a preset when the date matches one. */
export function reminderChoiceFor(visitDate: IsoDate, remindOn: IsoDate | null): ReminderChoice {
  if (!remindOn) return "";
  return reminderPresets.find((p) => reminderDate(visitDate, p) === remindOn) ?? "date";
}

export type ReminderForm = { remindAfter?: string; remindOn?: string };

/** N7: the chosen reminder as a date. The doctor's own date must come after the visit. */
export function parseReminder(form: ReminderForm, visitDate: IsoDate): { ok: true; remindOn: IsoDate | null } | { ok: false } {
  const choice = (form.remindAfter ?? "").trim();
  if (choice === "") return { ok: true, remindOn: null };
  if (isPreset(choice)) return { ok: true, remindOn: reminderDate(visitDate, choice) };
  const own = (form.remindOn ?? "").trim();
  if (choice === "date" && isIsoDate(own) && own > visitDate) return { ok: true, remindOn: own };
  return { ok: false };
}

/** N7 ✏️: the procedure type of the visit the reminder was set in («Ботокс», «Биоревитализация»…). */
export type ReminderType = { id: string; code: string | null; name: Localized };

/** N7: a reminder that is not «Готово» yet – one per visit, with the visit's procedure types. */
export type OpenReminder = { visitId: string; remindOn: IsoDate; types: ReminderType[] };

/**
 * N7: «⏰ Пора» from the reminder day until «Готово» – every reminder that has come (oldest first,
 * each closed on its own), and the next one still to come.
 */
export function reminderStatus(open: readonly OpenReminder[], today: IsoDate): { due: OpenReminder[]; next: IsoDate | null } {
  const sorted = [...open].sort((a, b) => a.remindOn.localeCompare(b.remindOn));
  return { due: sorted.filter((r) => r.remindOn <= today), next: sorted.find((r) => r.remindOn > today)?.remindOn ?? null };
}

/** N7 ✏️: one type once, even when several preparations of the visit share it. */
export function uniqueTypes(types: readonly ReminderType[]): ReminderType[] {
  return types.filter((t, i) => types.findIndex((x) => x.id === t.id) === i);
}

/**
 * N7 ✏️ (Loya 05.11.2026): «⏰ Пора» at the top of the list grouped by procedure type – «Ботокс» first,
 * then the catalogue order (BT-01 … BT-10), own types by name, a visit without preparations last
 * («Процедура», type null). A client is listed once per type.
 */
export function dueByType<C extends { id: string; dueReminders: readonly OpenReminder[] }>(
  clients: readonly C[],
): { type: ReminderType | null; clients: C[] }[] {
  const groups = new Map<string, { type: ReminderType | null; clients: C[] }>();
  for (const client of clients) {
    for (const reminder of client.dueReminders) {
      for (const type of reminder.types.length > 0 ? reminder.types : [null]) {
        const key = type?.id ?? "none";
        const group = groups.get(key) ?? { type, clients: [] };
        if (!group.clients.some((c) => c.id === client.id)) group.clients.push(client);
        groups.set(key, group);
      }
    }
  }
  const rank = (t: ReminderType | null) => (t === null ? "3" : t.code ? `1${t.code}` : `2${t.name.ru ?? ""}`);
  return [...groups.values()].sort((a, b) => rank(a.type).localeCompare(rank(b.type)));
}

/** N7: a changed reminder date starts again (not done); the same date keeps «Готово». */
export function keptReminderDone(previous: { remindOn: IsoDate | null; reminderDoneAt: string | null } | null, remindOn: IsoDate | null): string | null {
  return previous && remindOn !== null && previous.remindOn === remindOn ? previous.reminderDoneAt : null;
}
