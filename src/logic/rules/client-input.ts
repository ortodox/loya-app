import { isLocale } from "@/logic/locale";
import type { Anamnesis, ClientInput, IsoDate } from "@/logic/client";
import { parseAnamnesisForm, type AnamnesisForm } from "./anamnesis";
import { isCountryCode } from "./country";
import { isIsoDate } from "./dates";

export type ClientInputError =
  | "nameRequired"
  | "dateInvalid"
  | "ageInvalid"
  | "birthDateInvalid"
  | "ageAndBirthDate"
  | "emailInvalid"
  | "countryInvalid";

export const clientFormFields = [
  "fullName",
  "cardDate",
  "age",
  "birthDate",
  "phone",
  "email",
  "residenceCountry",
  "residenceCity",
  "language",
  "notes",
] as const;
export type ClientFormField = (typeof clientFormFields)[number];

/** Raw form values; every field may be missing or blank. */
export type ClientForm = Partial<Record<ClientFormField, string>> & { anamnesis?: AnamnesisForm };

export type ClientInputErrors = Partial<Record<ClientFormField, ClientInputError>>;

export type ParsedClientInput =
  | { ok: true; input: ClientInput }
  | { ok: false; errors: ClientInputErrors };

const blank = (v: string | undefined) => (v ?? "").trim();
const orNull = (v: string | undefined) => blank(v) || null;
const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * PR1: only the name is required; the rest is optional, age OR birth date.
 * `previousAnamnesis` keeps keys that are not in the template when editing.
 */
export function parseClientForm(
  form: ClientForm,
  today: IsoDate,
  previousAnamnesis: Anamnesis = {},
): ParsedClientInput {
  const errors: ClientInputErrors = {};

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

  const emailValue = orNull(form.email);
  if (emailValue && !email.test(emailValue)) errors.email = "emailInvalid";

  const residenceCountry = orNull(form.residenceCountry);
  if (residenceCountry && !isCountryCode(residenceCountry)) {
    errors.residenceCountry = "countryInvalid";
  }

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
      email: emailValue,
      residenceCountry,
      residenceCity: orNull(form.residenceCity),
      language: isLocale(language) ? language : "ru",
      anamnesis: parseAnamnesisForm(form.anamnesis ?? {}, previousAnamnesis),
      notes: (form.notes ?? "").trim() ? (form.notes ?? "").replace(/\s+$/, "") : null,
    },
  };
}
