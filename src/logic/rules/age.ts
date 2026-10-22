import type { IsoDate } from "@/logic/client";
import { wholeYearsBetween } from "./dates";

export type AgeSource = {
  birthDate: IsoDate | null;
  ageAtRegistration: number | null;
  /** «Дата»: when the age was recorded. */
  cardDate: IsoDate;
};

/**
 * AG1: the current age of a client.
 * - With a birth date: whole years since the birth date.
 * - Otherwise: the age recorded at registration plus whole years since registration.
 * - Null when neither is known.
 */
export function currentAge(source: AgeSource, today: IsoDate): number | null {
  if (source.birthDate) return wholeYearsBetween(source.birthDate, today);
  if (source.ageAtRegistration === null) return null;
  return source.ageAtRegistration + wholeYearsBetween(source.cardDate, today);
}
