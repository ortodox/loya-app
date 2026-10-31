import type { Client, IsoDate } from "@/logic/client";
import { todayIn } from "./dates";

/** PR6: how long a deleted client stays in «Удалённые клиенты» before it is deleted for good. */
export const trashDays = 30;

const dayMs = 24 * 60 * 60 * 1000;

/** PR6: when the client will be deleted for good – 30 days after «Удалить клиента». */
export function purgeAt(deletedAt: string): Date {
  return new Date(new Date(deletedAt).getTime() + trashDays * dayMs);
}

/** PR6: the 30 days are over – the client, its rows and files are deleted on the next run. */
export const isExpired = (deletedAt: string, now: Date): boolean => now.getTime() >= purgeAt(deletedAt).getTime();

/** PR6: the date shown in «Удалённые клиенты» («Будет удалён навсегда: …»), in the practice's time zone. */
export const purgeDate = (deletedAt: string, timeZone: string): IsoDate => todayIn(timeZone, purgeAt(deletedAt));

/** PR6: extra warning before deleting – planned visits (after today) and an active treatment course. */
export function deleteWarnings(client: Pick<Client, "visitDates" | "courses">, today: IsoDate): { plannedVisits: number; activeCourse: boolean } {
  return {
    plannedVisits: client.visitDates.filter((d) => d > today).length,
    activeCourse: client.courses.some((c) => c.status === "active"),
  };
}
