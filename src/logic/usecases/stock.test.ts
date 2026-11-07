import { describe, expect, it } from "vitest";
import type { CatalogRepository } from "@/data/repositories/catalog";
import type { StockItem, StockRepository } from "@/data/repositories/stock";
import type { ConsumptionVisit } from "@/logic/rules/consumption";
import { addToStock, correctStock, discardVial, getStockOverview, getVisitStock, listAddablePreparations, receiveStock, stockClientNames } from "./stock";

const today = "2026-11-10";
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const botoxType = { id: "t1", code: "BT-01", name: { ru: "Ботулинотерапия" } };
const fillerType = { id: "t2", code: "BT-02", name: { ru: "Филлеры" } };
const BOTOX = id(1);
const FILLER = id(2);

function setup(visits: ConsumptionVisit[] = []) {
  let n = 100;
  const items: StockItem[] = [];
  const stock: StockRepository = {
    listItems: async () => items.map((i) => ({ ...i, receipts: [...i.receipts], adjustments: [...i.adjustments] })),
    addItem: async (preparationId, startedOn, vialSizes) => {
      const item: StockItem = {
        id: id(n++),
        preparationId,
        preparationName: preparationId === BOTOX ? "Botox" : "Juvederm",
        type: preparationId === BOTOX ? botoxType : fillerType,
        startedOn,
        vialSizes,
        receipts: [],
        adjustments: [],
        changes: [],
      };
      items.push(item);
      return { id: item.id };
    },
    addReceipt: async (itemId, input) => {
      items.find((i) => i.id === itemId)!.receipts.push({ ...input, id: `r${n++}`, createdAt: `c${n}` });
    },
    clientNames: async (ids) => Object.fromEntries(ids.map((i) => [i, { name: `Клиент ${i}`, deleted: i === "gone" }])),
    setVialSizes: async (itemId, sizes) => {
      items.find((i) => i.id === itemId)!.vialSizes = sizes;
    },
    addAdjustments: async (itemId, list) => {
      items.find((i) => i.id === itemId)!.adjustments.push(...list.map((a) => ({ ...a, createdAt: `c${n++}` })));
    },
  };
  const catalog = {
    listPreparations: async () => [
      { id: BOTOX, name: "Botox", procedureTypeId: "t1" },
      { id: FILLER, name: "Juvederm", procedureTypeId: "t2" },
    ],
    listTypes: async () => [botoxType, fillerType],
    getPreparation: async (pid: string) => (pid === BOTOX || pid === FILLER ? { id: pid } : null),
  } as unknown as CatalogRepository;
  return { deps: { stock, catalog, visits: { listVisits: async () => visits } }, items };
}
const visit = (visitId: string, clientId: string, visitDate: string, key: string, quantity: string | null): ConsumptionVisit => ({
  visitId,
  createdAt: visitDate,
  clientId,
  visitDate,
  remindOn: null,
  items: [{ key, name: key, type: key === BOTOX ? botoxType : fillerType, quantity }],
});

describe("SK1: склад – настройка и поступления", () => {
  it("SK1: botox needs its vial sizes, the rest is counted in pieces; a preparation is added once", async () => {
    const { deps, items } = setup();
    expect(await addToStock(deps, BOTOX, [], today)).toEqual({ ok: false, error: "sizesRequired" });
    expect((await addToStock(deps, BOTOX, ["100", "50"], today)).ok).toBe(true);
    expect(items[0]).toMatchObject({ startedOn: today, vialSizes: [50, 100] });
    expect((await addToStock(deps, FILLER, [], today)).ok).toBe(true);
    expect(items[1].vialSizes).toBeNull();
    expect(await addToStock(deps, BOTOX, ["100"], today)).toEqual({ ok: false, error: "already" });
    expect(await addToStock(deps, id(9), [], today)).toEqual({ ok: false, error: "notFound" });
    expect(await listAddablePreparations(deps)).toEqual([]);
  });

  it("SK1: «+ Поступление» – a size of the preparation, a count, or one already opened vial", async () => {
    const { deps, items } = setup();
    await addToStock(deps, BOTOX, ["100"], today);
    const item = items[0].id;
    expect(await receiveStock(deps, item, { vialSize: "200", count: "2" }, today)).toEqual({ ok: false, errors: { vialSize: "invalid" } });
    expect(await receiveStock(deps, item, { vialSize: "100", count: "0" }, today)).toEqual({ ok: false, errors: { count: "invalid" } });
    expect(await receiveStock(deps, item, { vialSize: "100", count: "2" }, today)).toEqual({ ok: true });
    expect(await receiveStock(deps, item, { vialSize: "100", opened: "1", openedOn: "2026-11-03", remaining: "150" }, today)).toEqual({ ok: false, errors: { remaining: "invalid" } });
    expect(await receiveStock(deps, item, { vialSize: "100", opened: "1", openedOn: "2026-11-03", remaining: "60" }, today)).toEqual({ ok: true });
    const [line] = await getStockOverview(deps, today);
    expect(line.state.available).toBe(260);
    expect(line.state.openVials.map((v) => [v.openedOn, v.remaining])).toEqual([["2026-11-03", 60]]);
  });
});

describe("SK1: склад – визиты, «В наличии» и «После записей»", () => {
  it("SK1: visits done since stock-keeping began are taken off; planned ones only in «После записей»", async () => {
    const { deps, items } = setup([
      visit("v0", "a", "2026-11-01", BOTOX, "50"),
      visit("v1", "a", "2026-11-12", BOTOX, "20+15"),
      visit("v2", "b", "2026-11-20", BOTOX, "лоб"),
      visit("v3", "b", "2026-10-01", BOTOX, "30"),
    ]);
    await addToStock(deps, BOTOX, ["100"], "2026-11-05");
    await receiveStock(deps, items[0].id, { receivedOn: "2026-11-05", vialSize: "100", count: "2" }, "2026-11-05");
    const later = "2026-11-15";
    const [line] = await getStockOverview(deps, later);
    expect(line.state.available).toBe(165);
    expect(line.afterPlanned).toBe(135);
    expect(line.plannedUnknown).toBe(0);
    expect((await getVisitStock(deps, later, "v1"))[BOTOX]).toEqual({ kind: "vials", available: 200 });
  });

  it("SK1: «Списать остаток» and «Исправить остаток»", async () => {
    const { deps, items } = setup([visit("v1", "a", "2026-11-06", BOTOX, "30")]);
    await addToStock(deps, BOTOX, ["50", "100"], "2026-11-05");
    await addToStock(deps, FILLER, [], "2026-11-05");
    const [botox, filler] = items.map((i) => i.id);
    await receiveStock(deps, botox, { receivedOn: "2026-11-05", vialSize: "100", count: "2" }, "2026-11-05");
    await receiveStock(deps, filler, { receivedOn: "2026-11-05", count: "5" }, "2026-11-05");
    expect(await discardVial(deps, botox, "nope", today)).toBe(false);
    const [line] = await getStockOverview(deps, today);
    const open = line.state.openVials[0].key;
    expect(await discardVial(deps, botox, open, today)).toBe(true);
    expect((await getStockOverview(deps, today))[0].state.available).toBe(100);
    expect(await correctStock(deps, botox, { closed: { "100": "0", "50": "2" } }, today)).toBe("ok");
    expect((await getStockOverview(deps, today))[0].state.closed).toEqual([{ size: 50, count: 2 }]);
    expect(await correctStock(deps, filler, { pieces: "3" }, today)).toBe("ok");
    expect((await getStockOverview(deps, today))[1].state.available).toBe(3);
    expect(await correctStock(deps, filler, { pieces: "-1" }, today)).toBe("invalid");
  });
});

describe("SK1 ✏️: размеры флаконов и открытый флакон при исправлении", () => {
  it("SK1 ✏️ B: «Другой размер» adds the size to the preparation and receives vials of it", async () => {
    const { deps, items } = setup();
    await addToStock(deps, BOTOX, ["100"], today);
    expect(await receiveStock(deps, items[0].id, { vialSize: "", newSize: "abc", count: "1" }, today)).toEqual({ ok: false, errors: { vialSize: "invalid" } });
    expect(await receiveStock(deps, items[0].id, { vialSize: "", newSize: "50", count: "2" }, today)).toEqual({ ok: true });
    expect(items[0].vialSizes).toEqual([50, 100]);
    expect((await getStockOverview(deps, today))[0].state.closed).toEqual([{ size: 50, count: 2 }]);
  });

  it("SK1 ✏️ A: an open vial the app did not know about – size and what is left; more than the size is refused", async () => {
    const { deps, items } = setup();
    await addToStock(deps, BOTOX, ["100"], today);
    await receiveStock(deps, items[0].id, { vialSize: "100", count: "2" }, today);
    expect(await correctStock(deps, items[0].id, { closed: { "100": "1" }, openNew: { size: "100", remaining: "150" } }, today)).toBe("invalid");
    expect(await correctStock(deps, items[0].id, { closed: { "100": "1" }, openNew: { size: "100", remaining: "20" } }, today)).toBe("ok");
    const [line] = await getStockOverview(deps, today);
    expect(line.state.available).toBe(120);
    expect(line.state.openVials.map((v) => v.remaining)).toEqual([20]);
  });
});

describe("SK6: исправление при минусе", () => {
  it("SK6: correcting a minus clears it and keeps what is entered", async () => {
    const { deps, items } = setup([visit("v1", "a", "2026-11-06", BOTOX, "130")]);
    await addToStock(deps, BOTOX, ["100"], "2026-11-05");
    await receiveStock(deps, items[0].id, { receivedOn: "2026-11-05", vialSize: "100", count: "1" }, "2026-11-05");
    expect((await getStockOverview(deps, today))[0].state.available).toBe(-30);
    expect(await correctStock(deps, items[0].id, { closed: { "100": "1" } }, today)).toBe("ok");
    expect((await getStockOverview(deps, today))[0].state.available).toBe(100);
  });
});

describe("SK7: имя клиента в истории", () => {
  it("SK7: visit lines know their client; the names are looked up once for all lines", async () => {
    const { deps, items } = setup([visit("v1", "a", "2026-11-06", BOTOX, "20"), visit("v2", "gone", "2026-11-07", BOTOX, "5")]);
    await addToStock(deps, BOTOX, ["100"], "2026-11-05");
    await receiveStock(deps, items[0].id, { receivedOn: "2026-11-05", vialSize: "100", count: "1" }, "2026-11-05");
    const lines = await getStockOverview(deps, today);
    expect(lines[0].state.history.filter((h) => h.kind === "visit").map((h) => h.clientId)).toEqual(["gone", "a"]);
    expect(await stockClientNames(deps, lines)).toEqual({ a: { name: "Клиент a", deleted: false }, gone: { name: "Клиент gone", deleted: true } });
  });
});
