"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { practiceTimeZone } from "@/config/time";
import { shopRepository } from "@/data/repositories/server";
import { todayIn } from "@/logic/rules/dates";
import { deleteShopHistoryLine, saveShopProduct, tapShopProduct, toggleShopFavorite, type ShopProductErrors, type ShopProductForm } from "@/logic/usecases/shop";

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");

/** MG2: «−» (sale) or «+» (delivery). */
export async function tapShopAction(productId: string, kind: "sale" | "receipt"): Promise<{ ok: boolean }> {
  try {
    const ok = await tapShopProduct(await shopRepository(), productId, kind, todayIn(practiceTimeZone));
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
export async function deleteShopHistoryAction(productId: string, date: string, kind: string): Promise<{ ok: boolean }> {
  try {
    const ok = await deleteShopHistoryLine(await shopRepository(), productId, date, kind);
    if (ok) revalidatePath("/shop");
    return { ok };
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
  redirect("/shop?view=catalog");
}
