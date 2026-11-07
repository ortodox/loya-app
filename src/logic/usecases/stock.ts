import type { IsoDate } from "@/logic/client";
import { botoxUnits, isBotox, pieces, type ConsumptionVisit } from "@/logic/rules/consumption";
import { isIsoDate } from "@/logic/rules/dates";
import type { ReminderType } from "@/logic/rules/reminders";
import { closedVialsToRemove, parseVialSizes, simulateStock, type StockKind, type StockState, type StockUse } from "@/logic/rules/stock";
import { practiceTimeZone } from "@/config/time";
import { summarizeChanges, type StockChangeLine } from "@/logic/rules/stock-changes";
import type { CatalogRepository } from "@/data/repositories/catalog";
import type { ConsumptionRepository } from "@/data/repositories/consumption";
import type { StockItem, StockRepository } from "@/data/repositories/stock";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type StockDeps = { stock: StockRepository; visits: ConsumptionRepository; catalog: CatalogRepository };

/** SK1: one preparation in «Склад». */
export type StockLine = {
  itemId: string;
  preparationId: string;
  name: string;
  type: ReminderType | null;
  kind: StockKind;
  vialSizes: number[] | null;
  state: StockState;
  /** «После записей» – what is left when the planned visits have been done. */
  afterPlanned: number;
  /** Planned botox visits without a number (and no earlier number for that client). */
  plannedUnknown: number;
  /** SK4: what was changed afterwards (visits, receipts, corrections), newest first. */
  changes: StockChangeLine[];
};

const kindOf = (item: StockItem): StockKind => (item.vialSizes ? "vials" : "pieces");

/** SK1: the uses of one preparation in visits done since stock-keeping began. */
function usesOf(item: StockItem, visits: readonly ConsumptionVisit[], today: IsoDate, excludeVisitId: string | null): StockUse[] {
  const kind = kindOf(item);
  return visits
    .filter((v) => v.visitDate <= today && v.visitDate >= item.startedOn && v.visitId !== excludeVisitId)
    .flatMap((v) =>
      v.items
        .filter((i) => i.key === item.preparationId)
        .map((i) => ({ date: v.visitDate, amount: kind === "vials" ? botoxUnits(i.quantity) : pieces(i.quantity), createdAt: i.savedAt ?? v.createdAt ?? "", quantity: i.quantity, clientId: v.clientId })),
    );
}

/** SK1 «После записей»: planned visits take their amount; botox without a number takes the client's last one. */
function planned(item: StockItem, visits: readonly ConsumptionVisit[], today: IsoDate): { amount: number; unknown: number } {
  const kind = kindOf(item);
  const last = (clientId: string) => {
    const done = visits.filter((v) => v.clientId === clientId && v.visitDate <= today).sort((a, b) => b.visitDate.localeCompare(a.visitDate));
    for (const v of done) for (const i of v.items) if (i.key === item.preparationId && botoxUnits(i.quantity) !== null) return botoxUnits(i.quantity);
    return null;
  };
  let amount = 0;
  let unknown = 0;
  for (const v of visits.filter((x) => x.visitDate > today)) {
    for (const i of v.items.filter((x) => x.key === item.preparationId)) {
      const value = kind === "vials" ? botoxUnits(i.quantity) ?? last(v.clientId) : pieces(i.quantity);
      if (value === null) unknown++;
      else amount += value;
    }
  }
  return { amount, unknown };
}

function line(item: StockItem, visits: readonly ConsumptionVisit[], today: IsoDate, excludeVisitId: string | null = null): StockLine {
  const state = simulateStock(kindOf(item), item.receipts, usesOf(item, visits, today, excludeVisitId), item.adjustments);
  const p = planned(item, visits, today);
  return {
    itemId: item.id,
    preparationId: item.preparationId,
    name: item.preparationName,
    type: item.type,
    kind: kindOf(item),
    vialSizes: item.vialSizes,
    state,
    afterPlanned: state.available - p.amount,
    plannedUnknown: p.unknown,
    // SK7: changes logged before the client was stored – the visit, if it is still there, tells whose it is.
    changes: summarizeChanges(
      item.changes.map((c) => ({ ...c, clientId: c.clientId ?? visits.find((v) => v.visitId === c.visitId)?.clientId ?? null })),
      practiceTimeZone,
    ),
  };
}

const rank = (t: ReminderType | null) => (t === null ? "3" : t.code ? `1${t.code}` : `2${t.name.ru ?? ""}`);

/** SK1 «Склад»: every preparation kept in stock – by type (catalogue order), then name. No client names. */
export async function getStockOverview(deps: Pick<StockDeps, "stock" | "visits">, today: IsoDate): Promise<StockLine[]> {
  const [items, visits] = await Promise.all([deps.stock.listItems(), deps.visits.listVisits()]);
  return items
    .map((i) => line(i, visits, today))
    .sort((a, b) => rank(a.type).localeCompare(rank(b.type)) || a.name.localeCompare(b.name, "ru"));
}

/** SK1: one preparation in stock (for receipts and corrections). */
export async function getStockLine(deps: Pick<StockDeps, "stock" | "visits">, itemId: string, today: IsoDate): Promise<StockLine | null> {
  if (!uuid.test(itemId)) return null;
  return (await getStockOverview(deps, today)).find((l) => l.itemId === itemId) ?? null;
}

/**
 * SK1: «В наличии» for the visit form – per preparation kept in stock. A visit being edited leaves its
 * own use out, so the number is what was there before it.
 */
export async function getVisitStock(
  deps: Pick<StockDeps, "stock" | "visits">,
  today: IsoDate,
  excludeVisitId: string | null,
): Promise<Record<string, { kind: StockKind; available: number }>> {
  const [items, visits] = await Promise.all([deps.stock.listItems(), deps.visits.listVisits()]);
  return Object.fromEntries(items.map((i) => [i.preparationId, { kind: kindOf(i), available: line(i, visits, today, excludeVisitId).state.available }]));
}

/** SK1 «+ Добавить препарат»: catalogue preparations not yet kept in stock, botox marked. */
export async function listAddablePreparations(deps: Pick<StockDeps, "stock" | "catalog">) {
  const [items, preparations, types] = await Promise.all([deps.stock.listItems(), deps.catalog.listPreparations(), deps.catalog.listTypes()]);
  const tracked = new Set(items.map((i) => i.preparationId));
  const typeOf = new Map(types.map((t) => [t.id, { id: t.id, code: t.code, name: t.name } as ReminderType]));
  return preparations
    .filter((p) => !tracked.has(p.id))
    .map((p) => {
      const type = typeOf.get(p.procedureTypeId) ?? null;
      return { id: p.id, name: p.name, type, botox: isBotox(type) };
    })
    .sort((a, b) => rank(a.type).localeCompare(rank(b.type)) || a.name.localeCompare(b.name, "ru"));
}

export type AddStockResult = { ok: true; id: string } | { ok: false; error: "notFound" | "already" | "sizesRequired" };

/** SK1: start keeping a preparation in stock from today – botox with its vial sizes, the rest in pieces. */
export async function addToStock(deps: Pick<StockDeps, "stock" | "catalog">, preparationId: string, vialSizes: readonly string[], today: IsoDate): Promise<AddStockResult> {
  const addable = (await listAddablePreparations(deps)).find((p) => p.id === preparationId);
  if (!addable) {
    const exists = uuid.test(preparationId) && (await deps.catalog.getPreparation(preparationId));
    return { ok: false, error: exists ? "already" : "notFound" };
  }
  const sizes = addable.botox ? parseVialSizes(vialSizes) : null;
  if (addable.botox && !sizes) return { ok: false, error: "sizesRequired" };
  return { ok: true, ...(await deps.stock.addItem(preparationId, today, sizes)) };
}

export type ReceiptForm = { receivedOn?: string; vialSize?: string; /** SK1 ✏️ B: «Другой размер, ЕД». */ newSize?: string; count?: string; opened?: string; openedOn?: string; remaining?: string; lot?: string; expiresOn?: string };
export type ReceiptErrors = Partial<Record<"receivedOn" | "vialSize" | "count" | "openedOn" | "remaining" | "expiresOn", "invalid">>;

/**
 * SK1 «+ Поступление»: vials of one of the preparation's sizes (botox) or pieces. An already opened
 * vial (when stock-keeping begins) is one vial with its opening date and what is left in it.
 */
export async function receiveStock(
  deps: Pick<StockDeps, "stock" | "visits">,
  itemId: string,
  form: ReceiptForm,
  today: IsoDate,
): Promise<{ ok: true } | { ok: false; notFound: true } | { ok: false; errors: ReceiptErrors }> {
  const current = await getStockLine(deps, itemId, today);
  if (!current) return { ok: false, notFound: true };
  const errors: ReceiptErrors = {};
  const receivedOn = (form.receivedOn ?? "").trim() || today;
  if (!isIsoDate(receivedOn) || receivedOn > today) errors.receivedOn = "invalid";
  const opened = current.kind === "vials" && form.opened === "1";
  const count = opened ? 1 : Number((form.count ?? "").trim());
  if (!Number.isInteger(count) || count < 1 || count > 1000) errors.count = "invalid";
  // SK1 ✏️ B: a size typed under «Другой размер» is added to the preparation's sizes.
  const typed = current.kind === "vials" && (form.newSize ?? "").trim() !== "" ? parseVialSizes([form.newSize!]) : null;
  if (current.kind === "vials" && (form.newSize ?? "").trim() !== "" && !typed) errors.vialSize = "invalid";
  const vialSize = current.kind === "vials" ? (typed ? typed[0] : Number(form.vialSize)) : null;
  if (current.kind === "vials" && !typed && !current.vialSizes?.includes(vialSize!)) errors.vialSize = "invalid";
  let openedOn: IsoDate | null = null;
  let remaining: number | null = null;
  if (opened) {
    openedOn = (form.openedOn ?? "").trim();
    if (!isIsoDate(openedOn) || openedOn > today) errors.openedOn = "invalid";
    remaining = Number((form.remaining ?? "").trim().replace(",", "."));
    if (!Number.isFinite(remaining) || remaining <= 0 || (vialSize !== null && remaining > vialSize)) errors.remaining = "invalid";
  }
  const expiresOn = (form.expiresOn ?? "").trim() || null;
  if (expiresOn !== null && !isIsoDate(expiresOn)) errors.expiresOn = "invalid";
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  if (typed && !current.vialSizes?.includes(typed[0])) await deps.stock.setVialSizes(current.itemId, parseVialSizes([...(current.vialSizes ?? []).map(String), String(typed[0])])!);
  await deps.stock.addReceipt(current.itemId, {
    receivedOn: opened && openedOn! < receivedOn ? openedOn! : receivedOn,
    vialSize,
    count,
    openedOn,
    remaining,
    lot: (form.lot ?? "").trim().slice(0, 100) || null,
    expiresOn,
  });
  return { ok: true };
}

/** SK1 «Списать остаток»: an open (or closed) vial is thrown away today. */
export async function discardVial(deps: Pick<StockDeps, "stock" | "visits">, itemId: string, vialKey: string, today: IsoDate): Promise<boolean> {
  const current = await getStockLine(deps, itemId, today);
  const present = current && [...current.state.openVials, ...current.state.closedVials].some((v) => v.key === vialKey);
  if (!current || !present) return false;
  await deps.stock.addAdjustments(current.itemId, [{ happenedOn: today, kind: "discard", vialKey, amount: null }]);
  return true;
}

export type CorrectForm = {
  pieces?: string;
  open?: Record<string, string>;
  closed?: Record<string, string>;
  /** SK1 ✏️ A: an open vial the app did not know about – its size and what is left in it. */
  openNew?: { size?: string; remaining?: string };
};

/**
 * SK1 «Исправить остаток»: what is really there today – pieces, or for botox what is left in each open
 * vial and how many closed vials of each size (fewer: the first received are taken out; more: added).
 */
export async function correctStock(deps: Pick<StockDeps, "stock" | "visits">, itemId: string, form: CorrectForm, today: IsoDate): Promise<"ok" | "notFound" | "invalid"> {
  const current = await getStockLine(deps, itemId, today);
  if (!current) return "notFound";
  const number = (v: string | undefined) => (v === undefined || v.trim() === "" ? null : Number(v.trim().replace(",", ".")));
  if (current.kind === "pieces") {
    const n = number(form.pieces);
    if (n === null || !Number.isInteger(n) || n < 0 || n > 10000) return "invalid";
    if (n !== current.state.available) await deps.stock.addAdjustments(current.itemId, [{ happenedOn: today, kind: "set", vialKey: null, amount: n }]);
    return "ok";
  }
  const adjustments: { happenedOn: IsoDate; kind: "discard" | "set"; vialKey: string | null; amount: number | null }[] = [];
  // SK6: the correction says what is really there – a minus is cleared first.
  const minus = current.state.available - current.state.openVials.reduce((sum, v) => sum + v.remaining, 0) - current.state.closedVials.reduce((sum, v) => sum + v.size, 0);
  if (minus < 0) adjustments.push({ happenedOn: today, kind: "set", vialKey: null, amount: 0 });
  for (const vial of current.state.openVials) {
    const n = number(form.open?.[vial.key]);
    if (n === null) continue;
    if (!Number.isFinite(n) || n < 0 || n > vial.size) return "invalid";
    if (n === 0) adjustments.push({ happenedOn: today, kind: "discard", vialKey: vial.key, amount: null });
    else if (n !== vial.remaining) adjustments.push({ happenedOn: today, kind: "set", vialKey: vial.key, amount: n });
  }
  const extra: { size: number; count: number }[] = [];
  for (const size of current.vialSizes ?? []) {
    const n = number(form.closed?.[String(size)]);
    if (n === null) continue;
    if (!Number.isInteger(n) || n < 0 || n > 1000) return "invalid";
    const have = current.state.closed.find((c) => c.size === size)?.count ?? 0;
    if (n < have) for (const key of closedVialsToRemove(current.state.closedVials, size, n)) adjustments.push({ happenedOn: today, kind: "discard", vialKey: key, amount: null });
    if (n > have) extra.push({ size, count: n - have });
  }
  let opened: { size: number; remaining: number } | null = null;
  const openRemaining = number(form.openNew?.remaining);
  if (openRemaining !== null) {
    const size = Number(form.openNew?.size ?? current.vialSizes?.[0]);
    if (!current.vialSizes?.includes(size) || !Number.isFinite(openRemaining) || openRemaining <= 0 || openRemaining > size) return "invalid";
    opened = { size, remaining: openRemaining };
  }
  await deps.stock.addAdjustments(current.itemId, adjustments);
  if (opened) await deps.stock.addReceipt(current.itemId, { receivedOn: today, vialSize: opened.size, count: 1, openedOn: today, remaining: opened.remaining, lot: null, expiresOn: null });
  for (const e of extra) await deps.stock.addReceipt(current.itemId, { receivedOn: today, vialSize: e.size, count: e.count, openedOn: null, remaining: null, lot: null, expiresOn: null });
  return "ok";
}

/** SK7: the names of the clients in «История» of these preparations (deleted clients marked, no link). */
export async function stockClientNames(deps: Pick<StockDeps, "stock">, lines: readonly StockLine[]): Promise<Record<string, { name: string; deleted: boolean }>> {
  const ids = new Set<string>();
  for (const l of lines) {
    for (const h of l.state.history) if (h.clientId) ids.add(h.clientId);
    for (const c of l.changes) if (c.clientId) ids.add(c.clientId);
  }
  return deps.stock.clientNames([...ids]);
}
