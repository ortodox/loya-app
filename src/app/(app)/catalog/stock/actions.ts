"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { practiceTimeZone } from "@/config/time";
import { todayIn } from "@/logic/rules/dates";
import { addToStock, correctStock, discardVial, receiveStock, type ReceiptErrors, type ReceiptForm } from "@/logic/usecases/stock";
import { stockDeps } from "./deps";

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");
const stockHome = "/catalog?view=stock";

export type AddStockState = { error?: "notFound" | "already" | "failed" };

/** SK1 «+ На склад»: start keeping the preparation, then go on to «+ Поступление». */
export async function addToStockAction(preparationId: string, _: AddStockState, fd: FormData): Promise<AddStockState> {
  const sizes = [...fd.getAll("size").map(str), ...str(fd.get("ownSize")).split(/[\s,;]+/)].filter(Boolean);
  let id: string;
  try {
    const result = await addToStock(await stockDeps(), preparationId, sizes, todayIn(practiceTimeZone));
    if (!result.ok) return { error: result.error };
    id = result.id;
  } catch {
    return { error: "failed" };
  }
  revalidatePath("/catalog");
  redirect(`/catalog/stock/${id}/receipts/new`);
}

export type ReceiptState = { values: ReceiptForm; errors?: ReceiptErrors; failed?: boolean };

/** SK1 «+ Поступление». */
export async function receiveStockAction(itemId: string, _: ReceiptState, fd: FormData): Promise<ReceiptState> {
  const values: ReceiptForm = Object.fromEntries(
    (["receivedOn", "vialSize", "newSize", "count", "opened", "openedOn", "remaining", "lot", "expiresOn"] as const).map((k) => [k, str(fd.get(k))]),
  );
  try {
    const result = await receiveStock(await stockDeps(), itemId, values, todayIn(practiceTimeZone));
    if (!result.ok) return "errors" in result ? { values, errors: result.errors } : { values, failed: true };
  } catch {
    return { values, failed: true };
  }
  revalidatePath("/catalog");
  redirect(stockHome);
}

/** SK1 «Исправить остаток»: field names «pieces», «open.<vial>», «closed.<size>». */
export async function correctStockAction(itemId: string, _: { failed?: boolean; invalid?: boolean }, fd: FormData) {
  const open: Record<string, string> = {};
  const closed: Record<string, string> = {};
  for (const [key, value] of fd.entries()) {
    if (key.startsWith("open.")) open[key.slice(5)] = str(value);
    if (key.startsWith("closed.")) closed[key.slice(7)] = str(value);
  }
  try {
    const openNew = { size: str(fd.get("openNew.size")), remaining: str(fd.get("openNew.remaining")) };
    const result = await correctStock(await stockDeps(), itemId, { pieces: str(fd.get("pieces")), open, closed, openNew }, todayIn(practiceTimeZone));
    if (result === "invalid") return { invalid: true };
    if (result === "notFound") return { failed: true };
  } catch {
    return { failed: true };
  }
  revalidatePath("/catalog");
  redirect(stockHome);
}

/** SK1 «Списать остаток». */
export async function discardVialAction(itemId: string, vialKey: string): Promise<{ ok: boolean }> {
  try {
    const ok = await discardVial(await stockDeps(), itemId, vialKey, todayIn(practiceTimeZone));
    if (ok) revalidatePath("/catalog");
    return { ok };
  } catch {
    return { ok: false };
  }
}
