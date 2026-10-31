import type { Client, IsoDate } from "@/logic/client";
import { currentAge } from "@/logic/rules/age";
import { parseClientForm, type ClientForm, type ClientInputErrors } from "@/logic/rules/client-input";
import { lastActivityDate, notesExcerpt, sortNewestFirst, visitTimeline } from "@/logic/rules/client-list";
import { safetyAlerts, type SafetyAlert } from "@/logic/rules/safety-alert";
import { chosenDirection, treatmentStatus, type TreatmentStatus } from "@/logic/rules/courses";
import type { Direction } from "@/logic/course";
import type { ClientRepository } from "@/data/repositories/clients";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ClientSummary = {
  id: string;
  fullName: string;
  date: IsoDate;
  age: number | null;
  /** PR5: ISO code of the country of residence. */
  residenceCountry: string | null;
  /** AL2: «Аллергоанамнез» is filled in – shown as a tag in the list. */
  allergy: boolean;
  excerpt: string;
  /** PR7: for the search by phone number (not shown). */
  phone: string | null;
  /** VP2: the next planned visit («Запись: 31.10»). */
  nextVisitDate: IsoDate | null;
  /** DM1: ✨ / 🩺 in the list and the filter. */
  direction: Direction[];
  /** LE4: «🩺 На лечении · N дн.» / «Курс закончился»; null when no active course. */
  treatment: TreatmentStatus | null;
};

/** PR2/VP2: all clients for the list, newest first. Search runs in the UI with `matchesClient`. */
export async function listClients(repo: ClientRepository, today: IsoDate): Promise<ClientSummary[]> {
  const withDates = (await repo.list()).map((c) => {
    const { last, next } = visitTimeline(c.visitDates, today);
    return { ...c, lastVisitDate: last, nextVisitDate: next };
  });
  return sortNewestFirst(withDates).map((c) => ({
    id: c.id,
    fullName: c.fullName,
    date: lastActivityDate(c),
    age: currentAge(c, today),
    residenceCountry: c.residenceCountry,
    allergy: safetyAlerts(c.anamnesis).some((a) => a.field === "allergies"),
    excerpt: notesExcerpt(c.notes),
    phone: c.phone,
    nextVisitDate: c.nextVisitDate,
    direction: c.direction,
    treatment: treatmentStatus(c.courses, today),
  }));
}

export type ClientCard = {
  client: Client;
  age: number | null;
  alerts: SafetyAlert[];
};

/** The client card with the current age (AG1) and safety alerts (AL2). */
export async function getClientCard(
  repo: ClientRepository,
  id: string,
  today: IsoDate,
): Promise<ClientCard | null> {
  if (!uuid.test(id)) return null;
  const client = await repo.get(id);
  if (!client) return null;
  return { client, age: currentAge(client, today), alerts: safetyAlerts(client.anamnesis) };
}

export type SaveClientResult =
  | { ok: true; id: string }
  | { ok: false; errors: ClientInputErrors }
  | { ok: false; notFound: true };

/** PR1: create a client from the form. */
export async function createClient(
  repo: ClientRepository,
  form: ClientForm,
  today: IsoDate,
): Promise<SaveClientResult> {
  const parsed = parseClientForm(form, today);
  if (!parsed.ok) return parsed;
  const { id } = await repo.create(parsed.input);
  return { ok: true, id };
}

/** PR1/PR3/JA1/AN1…: edit a client, including the clinical sections and free notes. */
export async function updateClient(
  repo: ClientRepository,
  id: string,
  form: ClientForm,
  today: IsoDate,
): Promise<SaveClientResult> {
  if (!uuid.test(id)) return { ok: false, notFound: true };
  const existing = await repo.get(id);
  if (!existing) return { ok: false, notFound: true };
  const parsed = parseClientForm(form, today, existing.anamnesis);
  if (!parsed.ok) return parsed;
  return (await repo.update(id, parsed.input)) ? { ok: true, id } : { ok: false, notFound: true };
}

/**
 * DM1: «Направление не указано» in the card – one tap sets the direction of an older client.
 * Only for a client without a direction; changing it later is done in «Изменить».
 */
export async function setMissingDirection(repo: ClientRepository, id: string, value: string): Promise<boolean> {
  const direction = chosenDirection(value);
  if (!direction || !uuid.test(id)) return false;
  const client = await repo.get(id);
  if (!client || client.direction.length > 0) return false;
  return repo.setDirection(id, [direction]);
}
