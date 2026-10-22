import { isLocale } from "@/logic/locale";
import type { ClientInput, IsoDate } from "@/logic/client";
import { isIsoDate } from "./dates";

export type ClientInputError =
  | "nameRequired"
  | "dateInvalid"
  | "ageInvalid"
  | "birthDateInvalid"
  | "ageAndBirthDate";

/** Raw form values; every field may be missing or blank. */
export type ClientForm = Partial<
  Record<"fullName" | "cardDate" | "age" | "birthDate" | "phone" | "language" | "notes", string>
>;

export type ParsedClientInput =
  | { ok: true; input: ClientInput }
  | { ok: false; errors: Partial<Record<keyof ClientForm, ClientInputError>> };

const blank = (v: string | undefined) => (v ?? "").trim();
const orNull = (v: string | undefined) => blank(v) || null;

/** PR1: only the name is required; the rest is optional, age OR birth date. */
export function parseClientForm(form: ClientForm, today: IsoDate): ParsedClientInput {
  const errors: Partial<Record<keyof ClientForm, ClientInputError>> = {};

  const fullName = blank(form.fullName).replace(/\s+/g, " ");
  if (!fullName) errors.fullName = "nameRequired";

  const cardDate = blank(form.cardDate) || today;
  if (!isIsoDate(cardDate)) errors.cardDate = "dateInvalid";

  const ageText = blank(form.age);
  const age = ageText ? Number(ageText) : null;
  if (age !== null && !(Number.isInteger(age) && age >= 0 && age <= 130)) {
    errors.age = "ageInvalid";
  }

  const birthDate = orNull(form.birthDate);
  if (birthDate && (!isIsoDate(birthDate) || birthDate > today || birthDate < "1900-01-01")) {
    errors.birthDate = "birthDateInvalid";
  }
  if (age !== null && birthDate) errors.birthDate = "ageAndBirthDate";

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const language = blank(form.language);
  return {
    ok: true,
    input: {
      fullName,
      cardDate,
      ageAtRegistration: age,
      birthDate,
      phone: orNull(form.phone),
      language: isLocale(language) ? language : "ru",
      notes: (form.notes ?? "").trim() ? (form.notes ?? "").replace(/\s+$/, "") : null,
    },
  };
}
