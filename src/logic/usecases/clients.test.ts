import { describe, expect, it } from "vitest";
import type { Client, ClientInput } from "@/logic/client";
import type { ClientRepository } from "@/data/repositories/clients";
import { createClient, getClientCard, listClients, updateClient } from "./clients";

const today = "2026-10-22";
const id1 = "00000000-0000-4000-8000-000000000001";
const id2 = "00000000-0000-4000-8000-000000000002";

function client(overrides: Partial<Client>): Client {
  return {
    id: id1,
    fullName: "Тестовая Клиентка",
    cardDate: "2025-01-01",
    ageAtRegistration: null,
    birthDate: null,
    phone: null,
    email: null,
    residenceCountry: null,
    residenceCity: null,
    language: "ru",
    anamnesis: {},
    notes: null,
    procedurePlan: null,
    anamnesisConfirmedAt: null,
    visitDates: [],
    direction: [],
    courses: [],
    careText: null,
    careUpdatedAt: null,
    updatedAt: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

function memoryRepo(initial: Client[] = []): ClientRepository & { rows: Client[] } {
  const rows = [...initial];
  let next = 100;
  const toClient = (id: string, input: ClientInput): Client =>
    client({ id, ...input, updatedAt: new Date().toISOString() });
  return {
    rows,
    list: async () => rows,
    get: async (id) => rows.find((r) => r.id === id) ?? null,
    create: async (input) => {
      const id = `00000000-0000-4000-8000-000000000${next++}`;
      rows.push(toClient(id, input));
      return { id };
    },
    update: async (id, input) => {
      const i = rows.findIndex((r) => r.id === id);
      if (i < 0) return false;
      rows[i] = { ...rows[i], ...input };
      return true;
    },
    setDirection: async (id, direction) => {
      const i = rows.findIndex((r) => r.id === id);
      if (i < 0) return false;
      rows[i] = { ...rows[i], direction };
      return true;
    },
    confirmAnamnesis: async (id, date) => {
      const i = rows.findIndex((r) => r.id === id);
      if (i < 0) return false;
      rows[i] = { ...rows[i], anamnesisConfirmedAt: date };
      return true;
    },
  };
}

describe("client use cases", () => {
  it("DM1/LE4: the list shows the direction and the days left of the active course", async () => {
    const repo = memoryRepo([
      client({ direction: ["dermatology"], courses: [{ status: "active", startDate: "2026-09-01", endDate: "2026-11-01" }] }),
    ]);
    expect(await listClients(repo, today)).toMatchObject([{ direction: ["dermatology"], treatment: { daysLeft: 10, ended: false } }]);
  });

  it("VP2: the list shows the last visit that took place and the next appointment", async () => {
    const repo = memoryRepo([client({ visitDates: ["2026-11-05", "2026-09-01", "2026-10-31"] })]);
    expect(await listClients(repo, today)).toMatchObject([{ date: "2026-09-01", nextVisitDate: "2026-10-31" }]);
  });

  it("PR2: lists newest first with date, current age and excerpt", async () => {
    const repo = memoryRepo([
      client({ id: id1, fullName: "Старая", cardDate: "2024-03-01", ageAtRegistration: 30 }),
      client({
        id: id2,
        fullName: "Новая",
        cardDate: "2026-10-01",
        residenceCountry: "NO",
        notes: "Чувствительная кожа",
      }),
    ]);
    expect(await listClients(repo, today)).toEqual([
      {
        id: id2,
        fullName: "Новая",
        date: "2026-10-01",
        age: null,
        residenceCountry: "NO",
        allergy: false,
        excerpt: "Чувствительная кожа",
        phone: null,
        nextVisitDate: null,
        direction: [],
        treatment: null,
      },
      { id: id1, fullName: "Старая", date: "2024-03-01", age: 32, residenceCountry: null, allergy: false, excerpt: "", phone: null, nextVisitDate: null, direction: [], treatment: null },
    ]);
  });

  it("AL2: the list marks clients with allergies, not with medications only", async () => {
    const repo = memoryRepo([
      client({ id: id1, anamnesis: { allergies: { text: "Лидокаин" } } }),
      client({ id: id2, anamnesis: { medications: { text: "Витамин D" } } }),
    ]);
    const list = await listClients(repo, today);
    expect(Object.fromEntries(list.map((c) => [c.id, c.allergy]))).toEqual({ [id1]: true, [id2]: false });
  });

  it("AG1/AL2: the card carries the current age and safety alerts", async () => {
    const repo = memoryRepo([
      client({ birthDate: "1990-06-01", anamnesis: { allergies: { text: "Лидокаин" } } }),
    ]);
    const card = await getClientCard(repo, id1, today);
    expect(card?.age).toBe(36);
    expect(card?.alerts).toEqual([{ field: "allergies", text: "Лидокаин" }]);
  });

  it("returns no card for unknown or malformed ids", async () => {
    const repo = memoryRepo();
    expect(await getClientCard(repo, id1, today)).toBeNull();
    expect(await getClientCard(repo, "not-a-uuid", today)).toBeNull();
  });

  it("PR1: creates with only a name and does not store invalid input", async () => {
    const repo = memoryRepo();
    const created = await createClient(repo, { fullName: "Вера Примерная" }, today);
    expect(created.ok).toBe(true);
    expect(repo.rows[0]).toMatchObject({ fullName: "Вера Примерная", cardDate: today, language: "ru" });

    expect(await createClient(repo, { fullName: "" }, today)).toEqual({
      ok: false,
      errors: { fullName: "nameRequired" },
    });
    expect(repo.rows).toHaveLength(1);
  });

  it("JA1/AN1: saves the clinical sections and keeps unknown anamnesis keys", async () => {
    const repo = memoryRepo([client({ anamnesis: { legacy: "x", allergies: { text: "старое" } } })]);
    await updateClient(
      repo,
      id1,
      {
        fullName: "Тестовая",
        anamnesis: { complaints: { choices: ["acne"] }, allergies: { text: "Пыльца ?" } },
      },
      today,
    );
    expect(repo.rows[0].anamnesis).toEqual({
      legacy: "x",
      complaints: { choices: ["acne"], text: "" },
      allergies: { text: "Пыльца ?" },
    });
    const card = await getClientCard(repo, id1, today);
    expect(card?.alerts).toEqual([{ field: "allergies", text: "Пыльца ?" }]);
  });

  it("PR3: updates notes and reports missing clients", async () => {
    const repo = memoryRepo([client({})]);
    expect(await updateClient(repo, id1, { fullName: "Тестовая", notes: "Заметка" }, today)).toEqual({
      ok: true,
      id: id1,
    });
    expect(repo.rows[0].notes).toBe("Заметка");
    expect(await updateClient(repo, id2, { fullName: "X" }, today)).toEqual({
      ok: false,
      notFound: true,
    });
  });
});
