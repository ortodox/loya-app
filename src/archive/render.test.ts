import { beforeAll, describe, expect, it } from "vitest";
import ru from "../../messages/ru.json";
import type { Client, Visit } from "@/logic/client";
import { clientCard } from "@/logic/usecases/clients";
import type { ArchiveData } from "@/logic/usecases/archive";
import { renderArchive } from "./render";

const today = "2026-11-03";
const client = {
  id: "aaaaaaaa-0000-4000-8000-000000000001",
  fullName: "Анна Выдуманная",
  cardDate: "2026-01-10",
  ageAtRegistration: 40,
  birthDate: null,
  phone: "+48 600 000 000",
  email: null,
  residenceCountry: "PL",
  residenceCity: "Краков",
  language: "ru",
  anamnesis: { allergies: { text: "Лидокаин" }, complaints: { choices: ["acne"], text: "" } },
  notes: "Любит утро",
  procedurePlan: null,
  anamnesisConfirmedAt: null,
  visitDates: [],
  direction: ["cosmetology"],
  courses: [],
  careText: null,
  careUpdatedAt: null,
  updatedAt: "t",
} as unknown as Client;
const visit = {
  id: "v1",
  clientId: client.id,
  visitDate: "2026-10-20",
  createdAt: "t",
  notes: "Коррекция через 2 недели",
  recommendations: "Не трогать лицо 4 часа",
  recommendationsLang: "ru",
  recommendationsEdited: false,
  faceScheme: { template: "front-photo-v1", strokes: [{ color: "red", width: 0.006, points: [[0.4, 0.3]] }] },
  remindOn: null,
  reminderDoneAt: null,
  items: [{ id: "i1", preparationId: null, preparationName: "Botox", procedureTypeId: null, quantity: "20 ЕД", sortOrder: 0 }],
  photos: [{ id: "p1", storagePath: "doc/v1/p1.jpg", sortOrder: 0 }],
  archive: { homeCareRecommendations: null, procedurePlan: null },
} as unknown as Visit;
const data: ArchiveData = {
  createdOn: today,
  clients: [{ card: clientCard(client, today), visits: [visit], courses: { active: [], completed: [] }, care: { text: null, updatedAt: null, photos: [] }, documents: [], photos: [] }],
  files: [],
};

describe("EX1: архив в HTML", () => {
  let pages: Awaited<ReturnType<typeof renderArchive>> = [];
  beforeAll(async () => {
    pages = await renderArchive(data, ru);
  });
  const page = (path: string) => pages.find((p) => p.path === path)!.content;

  it("EX1: index, style and one page per client", () => {
    expect(pages.map((p) => p.path)).toEqual(["index.html", "stil.css", `klienter/${client.id}.html`]);
  });

  it("EX1: the index lists the client with a link to her page, age, country and allergy", () => {
    const index = page("index.html");
    expect(index).toContain(`href="klienter/${client.id}.html"`);
    expect(index).toContain("Анна Выдуманная");
    expect(index).toContain("40 лет");
    expect(index).toContain("Аллергия");
    expect(index).toContain("noindex");
  });

  it("EX1: the client page shows the visit with preparation, sticker photo, scheme, notes and advice", () => {
    const html = page(`klienter/${client.id}.html`);
    expect(html).toContain("20.10.2026");
    expect(html).toContain("Botox");
    expect(html).toContain("20 ЕД");
    expect(html).toContain('src="../filer/visit-photos/v1/p1.jpg"');
    expect(html).toContain('href="../filer/face-front.webp"');
    expect(html).toContain("Коррекция через 2 недели");
    expect(html).toContain("Не трогать лицо 4 часа");
    expect(html).toContain("Лидокаин");
    expect(html).toContain('href="../index.html"');
  });

  it("EX1: no buttons or forms – only reading", () => {
    for (const p of pages) {
      expect(p.content).not.toMatch(/<form|<button|<script/);
    }
  });
});
