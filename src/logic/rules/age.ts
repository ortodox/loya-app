import type { IsoDate } from "@/logic/client";
import { parseIsoDate, wholeYearsBetween } from "./dates";

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

const isLeapYear = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/**
 * BD1: today is the client's birthday – only on the day itself, only with a birth date (an age
 * alone gives no day). Born on 29 February: shown on 28 February in other years.
 */
export function isBirthday(birthDate: IsoDate | null, today: IsoDate): boolean {
  const born = birthDate ? parseIsoDate(birthDate) : null;
  const now = parseIsoDate(today);
  if (!born || !now || birthDate! >= today) return false;
  if (born.m === 2 && born.d === 29 && !isLeapYear(now.y)) return now.m === 2 && now.d === 28;
  return born.m === now.m && born.d === now.d;
}
