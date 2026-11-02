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

/**
 * N7: «⏰ Пора» from the reminder day until «Готово» – the earliest open reminder that is due, and
 * the next one still to come.
 */
export function reminderStatus(openReminders: readonly IsoDate[], today: IsoDate): { due: IsoDate | null; next: IsoDate | null } {
  const sorted = [...openReminders].sort();
  return { due: sorted.find((d) => d <= today) ?? null, next: sorted.find((d) => d > today) ?? null };
}

/** N7: a changed reminder date starts again (not done); the same date keeps «Готово». */
export function keptReminderDone(previous: { remindOn: IsoDate | null; reminderDoneAt: string | null } | null, remindOn: IsoDate | null): string | null {
  return previous && remindOn !== null && previous.remindOn === remindOn ? previous.reminderDoneAt : null;
}
