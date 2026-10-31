import { describe, expect, it } from "vitest";
import type { Client } from "@/logic/client";
import type { ClientRepository } from "@/data/repositories/clients";
import type { DocumentStorage } from "@/data/repositories/documents";
import type { PhotoStorage } from "@/data/repositories/photos";
import type { ClientTrashRepository, DeletedClient } from "@/data/repositories/trash";
import { getDeleteWarnings, listDeletedClients, moveClientToTrash, purgeExpiredClients, restoreClient } from "./trash";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const anna = id(1);
const vera = id(2);
const now = new Date("2026-10-31T10:00:00Z");

function memory() {
  const clients = new Map<string, { fullName: string; deletedAt: string | null; visitDates: string[]; courses: Client["courses"] }>([
    [anna, { fullName: "Анна Выдуманная", deletedAt: null, visitDates: ["2026-11-05"], courses: [{ status: "active", startDate: "2026-09-01", endDate: "2027-02-28" }] }],
    [vera, { fullName: "Вера Примерная", deletedAt: null, visitDates: [], courses: [] }],
  ]);
  const files: Record<string, { photos: string[]; documents: string[] }> = {
    [anna]: { photos: ["d/v1/a.jpg", "d/client-photos/a/b.jpg"], documents: ["d/a/x.pdf"] },
    [vera]: { photos: [], documents: [] },
  };
  const removed: string[] = [];
  let failRemove = false;
  const clientRepo = {
    get: async (cid: string) => {
      const c = clients.get(cid);
      return c && !c.deletedAt ? ({ id: cid, ...c } as unknown as Client) : null;
    },
  } as unknown as ClientRepository;
  const trash: ClientTrashRepository = {
    moveToTrash: async (cid, at) => {
      const c = clients.get(cid);
      if (!c || c.deletedAt) return false;
      c.deletedAt = at;
      return true;
    },
    restore: async (cid) => {
      const c = clients.get(cid);
      if (!c?.deletedAt) return false;
      c.deletedAt = null;
      return true;
    },
    listDeleted: async () =>
      [...clients].flatMap(([cid, c]): DeletedClient[] => (c.deletedAt ? [{ id: cid, fullName: c.fullName, deletedAt: c.deletedAt }] : [])),
    filesOf: async (cid) => files[cid],
    purge: async (cid) => clients.delete(cid),
  };
  const remove = async (paths: string[]) => {
    if (failRemove) throw new Error("storage down");
    removed.push(...paths);
  };
  const photos = { remove } as unknown as PhotoStorage;
  const documents = { remove } as unknown as DocumentStorage;
  return { deps: { clients: clientRepo, trash, photos, documents }, clients, removed, failStorage: () => (failRemove = true) };
}

describe("PR6: удалить клиента", () => {
  it("PR6: «Удалить клиента» moves the client to the trash – it is gone from the card", async () => {
    const m = memory();
    expect(await moveClientToTrash(m.deps, anna, now)).toBe(true);
    expect(await m.deps.clients.get(anna)).toBeNull();
    expect(await moveClientToTrash(m.deps, anna, now)).toBe(false);
    expect(m.removed).toEqual([]);
  });

  it("PR6: the confirmation warns about planned visits and an active course", async () => {
    const m = memory();
    expect(await getDeleteWarnings(m.deps, anna, "2026-10-31")).toEqual({ plannedVisits: 1, activeCourse: true });
    expect(await getDeleteWarnings(m.deps, vera, "2026-10-31")).toEqual({ plannedVisits: 0, activeCourse: false });
  });

  it("PR6: «Восстановить» brings the client back", async () => {
    const m = memory();
    await moveClientToTrash(m.deps, anna, now);
    expect((await listDeletedClients(m.deps, "Europe/Warsaw")).map((c) => [c.fullName, c.purgeOn])).toEqual([["Анна Выдуманная", "2026-11-30"]]);
    expect(await restoreClient(m.deps, anna)).toBe(true);
    expect(await m.deps.clients.get(anna)).not.toBeNull();
    expect(await listDeletedClients(m.deps, "Europe/Warsaw")).toEqual([]);
  });
});

describe("PR6: удаление навсегда через 30 дней", () => {
  it("PR6: before 30 days nothing is deleted", async () => {
    const m = memory();
    await moveClientToTrash(m.deps, anna, now);
    expect(await purgeExpiredClients(m.deps, new Date("2026-11-29T10:00:00Z"))).toBe(0);
    expect(m.clients.has(anna)).toBe(true);
  });

  it("PR6: after 30 days the files and then the client are deleted for good", async () => {
    const m = memory();
    await moveClientToTrash(m.deps, anna, now);
    expect(await purgeExpiredClients(m.deps, new Date("2026-11-30T10:00:00Z"))).toBe(1);
    expect(m.removed).toEqual(["d/v1/a.jpg", "d/client-photos/a/b.jpg", "d/a/x.pdf"]);
    expect(m.clients.has(anna)).toBe(false);
    expect(m.clients.has(vera)).toBe(true);
  });

  it("PR6: when the files cannot be removed, the client stays and is tried again", async () => {
    const m = memory();
    await moveClientToTrash(m.deps, anna, now);
    m.failStorage();
    expect(await purgeExpiredClients(m.deps, new Date("2026-12-01T10:00:00Z"))).toBe(0);
    expect(m.clients.has(anna)).toBe(true);
  });
});
