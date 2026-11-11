"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { withSaved } from "@/logic/rules/saved";
import { practiceTimeZone } from "@/config/time";
import { shopRepository } from "@/data/repositories/server";
import { todayIn } from "@/logic/rules/dates";
import type { ShopMovementKind } from "@/logic/rules/shop";
import { returnShopSale, undoShopTap } from "@/logic/usecases/shop";
import { deleteShopHistoryLine, saveShopProduct, tapShopProduct, toggleShopFavorite, type ShopProductErrors, type ShopProductForm } from "@/logic/usecases/shop";

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");

/** MG2/MG6/UX6: «+» (delivery, also several at once), «−» sold or «−» correction; the id is for «Отменить». */
export async function tapShopAction(productId: string, kind: ShopMovementKind, quantity = 1): Promise<{ ok: boolean; id?: string }> {
  try {
    const id = await tapShopProduct(await shopRepository(), productId, kind, todayIn(practiceTimeZone), quantity);
    if (id) revalidatePath("/shop");
    return { ok: Boolean(id), id: id ?? undefined };
  } catch {
    return { ok: false };
  }
}

/** UX3 «Отменить» right after a tap in «Склад». */
export async function undoTapAction(movementId: string): Promise<{ ok: boolean }> {
  try {
    const ok = await undoShopTap(await shopRepository(), movementId);
    if (ok) revalidatePath("/shop");
    return { ok };
  } catch {
    return { ok: false };
  }
}

/** MG4: ⭐ on and off. */
export async function toggleShopFavoriteAction(productId: string): Promise<{ ok: boolean }> {
  try {
    const ok = await toggleShopFavorite(await shopRepository(), productId);
    if (ok) revalidatePath("/shop");
    return { ok };
  } catch {
    return { ok: false };
  }
}

/** MG2: «Удалить» a line of «История». */
export async function deleteShopHistoryAction(productId: string, date: string, kind: string): Promise<{ ok: boolean; negative?: boolean }> {
  try {
    const result = await deleteShopHistoryLine(await shopRepository(), productId, date, kind);
    if (result === "ok") revalidatePath("/shop");
    return { ok: result === "ok", negative: result === "negative" };
  } catch {
    return { ok: false };
  }
}

export type ShopProductState = { values: ShopProductForm; errors?: ShopProductErrors; failed?: boolean };

/** MG1: «+ Товар» / «Изменить». */
export async function saveShopProductAction(id: string | null, _: ShopProductState, fd: FormData): Promise<ShopProductState> {
  const values: ShopProductForm = Object.fromEntries(
    (["brand", "category", "name", "size", "currency", "price", "favorite", "hidden"] as const).map((k) => [k, str(fd.get(k))]),
  );
  let result;
  try {
    result = await saveShopProduct(await shopRepository(), id, values);
  } catch {
    return { values, failed: true };
  }
  if (!result.ok) return "errors" in result ? { values, errors: result.errors } : { values, failed: true };
  revalidatePath("/shop");
  redirect(withSaved("/shop?view=catalog"));
}

/** MG13: «Исправить» in «Продажи» → «Да» – one piece back to stock. */
export async function returnSaleAction(productId: string, month: string, currency: string): Promise<{ ok: boolean }> {
  try {
    const ok = await returnShopSale(await shopRepository(), productId, month, currency, todayIn(practiceTimeZone));
    if (ok) revalidatePath("/shop");
    return { ok };
  } catch {
    return { ok: false };
  }
}
