import { describe, expect, it } from "vitest";
import type { Client, Visit, VisitInput } from "@/logic/client";
import type { ClientRepository } from "@/data/repositories/clients";
import type { VisitRepository } from "@/data/repositories/visits";
import { listClients } from "./clients";
import { addVisit, deleteVisit, getVisit, listVisits, updateVisit } from "./visits";

const today = "2026-10-23";
const clientA = "00000000-0000-4000-8000-00000000000a";
const clientB = "00000000-0000-4000-8000-00000000000b";
const missing = "00000000-0000-4000-8000-0000000000ff";

const client = (id: string, fullName: string, cardDate: string): Client => ({
  id,
  fullName,
  cardDate,
  ageAtRegistration: null,
  birthDate: null,
  phone: null,
  email: null,
  residenceCountry: null,
  residenceCity: null,
  language: "ru",
  anamnesis: {},
  notes: null,
  lastVisitDate: null,
  updatedAt: "2026-01-01T00:00:00Z",
});

/** In-memory stand-in for both tables; list() derives lastVisitDate like the Supabase query does. */
function memory() {
  const clients = [client(clientA, "Анна Выдуманная", "2024-03-15"), client(clientB, "Вера Примерная", "2025-06-01")];
  const visits: Visit[] = [];
  let n = 0;
  const lastVisit = (id: string) =>
    visits.filter((v) => v.clientId === id).map((v) => v.visitDate).sort().at(-1) ?? null;
  const clientRepo: ClientRepository = {
    list: async () => clients.map((c) => ({ ...c, lastVisitDate: lastVisit(c.id) })),
    get: async (id) => clients.find((c) => c.id === id) ?? null,
    create: async () => ({ id: "x" }),
    update: async () => true,
  };
  const visitRepo: VisitRepository = {
    listByClient: async (id) => visits.filter((v) => v.clientId === id),
    get: async (id) => visits.find((v) => v.id === id) ?? null,
    create: async (clientId, input: VisitInput) => {
      const id = `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
      visits.push({ id, clientId, ...input, createdAt: `2026-10-23T10:00:${String(n).padStart(2, "0")}Z` });
      return { id };
    },
    update: async (id, input) => {
      const v = visits.find((x) => x.id === id);
      if (v) Object.assign(v, input);
      return Boolean(v);
    },
    delete: async (id) => {
      const i = visits.findIndex((v) => v.id === id);
      if (i >= 0) visits.splice(i, 1);
      return i >= 0;
    },
  };
  return { clients: clientRepo, visits: visitRepo, rows: visits };
}

describe("VS1: визиты в карте клиента", () => {
  it("VS1: lists the client's visits newest first", async () => {
    const repos = memory();
    await addVisit(repos, clientA, { visitDate: "2026-03-01", procedurePlan: "Пилинг" }, today);
    await addVisit(repos, clientA, { visitDate: "2026-10-01", homeCareRecommendations: "SPF" }, today);
    await addVisit(repos, clientB, { visitDate: "2026-10-20" }, today);
    const list = await listVisits(repos.visits, clientA);
    expect(list.map((v) => v.visitDate)).toEqual(["2026-10-01", "2026-03-01"]);
  });

  it("VS1: the client list shows the last visit date and sorts by it", async () => {
    const repos = memory();
    expect((await listClients(repos.clients, today)).map((c) => [c.fullName, c.date])).toEqual([
      ["Вера Примерная", "2025-06-01"],
      ["Анна Выдуманная", "2024-03-15"],
    ]);
    await addVisit(repos, clientA, { visitDate: "2026-02-01" }, today);
    await addVisit(repos, clientA, { visitDate: "2026-10-01" }, today);
    expect((await listClients(repos.clients, today)).map((c) => [c.fullName, c.date])).toEqual([
      ["Анна Выдуманная", "2026-10-01"],
      ["Вера Примерная", "2025-06-01"],
    ]);
  });

  it("VS1: adds a visit dated today by default", async () => {
    const repos = memory();
    const result = await addVisit(repos, clientA, {}, today);
    expect(result.ok).toBe(true);
    expect(repos.rows[0]).toMatchObject({ clientId: clientA, visitDate: today });
  });

  it("VS1: does not add a visit to an unknown client", async () => {
    const repos = memory();
    expect(await addVisit(repos, missing, {}, today)).toEqual({ ok: false, notFound: true });
    expect(await addVisit(repos, "bad-id", {}, today)).toEqual({ ok: false, notFound: true });
    expect(repos.rows).toHaveLength(0);
  });

  it("VS1: edits a visit", async () => {
    const repos = memory();
    const { id } = (await addVisit(repos, clientA, { visitDate: "2026-10-01" }, today)) as { id: string };
    expect(
      await updateVisit(repos.visits, clientA, id, { visitDate: "2026-10-02", procedurePlan: "Ботокс" }, today),
    ).toEqual({ ok: true, id });
    expect(repos.rows[0]).toMatchObject({ visitDate: "2026-10-02", procedurePlan: "Ботокс" });
  });

  it("VS1: deletes a visit", async () => {
    const repos = memory();
    const { id } = (await addVisit(repos, clientA, {}, today)) as { id: string };
    expect(await deleteVisit(repos.visits, clientA, id)).toBe(true);
    expect(repos.rows).toHaveLength(0);
  });

  it("VS1: a visit can only be read, edited or deleted through its own client", async () => {
    const repos = memory();
    const { id } = (await addVisit(repos, clientA, { procedurePlan: "Пилинг" }, today)) as { id: string };
    expect(await getVisit(repos.visits, clientB, id)).toBeNull();
    expect(await updateVisit(repos.visits, clientB, id, { procedurePlan: "X" }, today)).toEqual({
      ok: false,
      notFound: true,
    });
    expect(await deleteVisit(repos.visits, clientB, id)).toBe(false);
    expect(repos.rows[0].procedurePlan).toBe("Пилинг");
  });
});
