import type { Client, IsoDate } from "@/logic/client";
import { currentAge } from "@/logic/rules/age";
import { parseClientForm, type ClientForm, type ClientInputErrors } from "@/logic/rules/client-input";
import { lastActivityDate, notesExcerpt, sortNewestFirst } from "@/logic/rules/client-list";
import { safetyAlerts, type SafetyAlert } from "@/logic/rules/safety-alert";
import type { ClientRepository } from "@/data/repositories/clients";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ClientSummary = {
  id: string;
  fullName: string;
  date: IsoDate;
  age: number | null;
  /** PR5: ISO code of the country of residence. */
  residenceCountry: string | null;
  excerpt: string;
};

/** PR2: all clients for the list, newest first. Search runs in the UI with `matchesName`. */
export async function listClients(repo: ClientRepository, today: IsoDate): Promise<ClientSummary[]> {
  return sortNewestFirst(await repo.list()).map((c) => ({
    id: c.id,
    fullName: c.fullName,
    date: lastActivityDate(c),
    age: currentAge(c, today),
    residenceCountry: c.residenceCountry,
    excerpt: notesExcerpt(c.notes),
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
