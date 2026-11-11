"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { practiceTimeZone } from "@/config/time";
import { fetchNbpEurRate } from "@/data/nbp";
import { shopOrdersRepository, shopRepository } from "@/data/repositories/server";
import { todayIn } from "@/logic/rules/dates";
import { cancelOrder, getEurRate, saveOrder, setOrderHandedOver, setOwnEurRate, type OrderErrors, type OrderFormInput } from "@/logic/usecases/shop-orders";

/** MG9: «Сохранить» a new or changed order; back to «Заказы» when saved. */
export async function saveOrderAction(id: string | null, input: OrderFormInput): Promise<{ errors?: OrderErrors; failed?: boolean }> {
  let result;
  try {
    const orders = await shopOrdersRepository();
    const { rate } = await getEurRate(orders, fetchNbpEurRate);
    result = await saveOrder(await shopRepository(), orders, id, input, todayIn(practiceTimeZone), rate);
  } catch {
    return { failed: true };
  }
  if (!result.ok) return "errors" in result ? { errors: result.errors } : { failed: true };
  revalidatePath("/shop");
  redirect("/shop?view=orders");
}

/** MG12: «Выдан ✓» or back to waiting. */
export async function handOverOrderAction(id: string, handed: boolean): Promise<{ ok: boolean }> {
  try {
    const ok = await setOrderHandedOver(await shopOrdersRepository(), id, handed, todayIn(practiceTimeZone));
    if (ok) revalidatePath("/shop");
    return { ok };
  } catch {
    return { ok: false };
  }
}

/** MG12: «Отменить заказ» – products back to stock, out of «Продажи». */
export async function cancelOrderAction(id: string): Promise<{ ok: boolean }> {
  let ok = false;
  try {
    ok = await cancelOrder(await shopOrdersRepository(), id);
  } catch {
    return { ok: false };
  }
  if (!ok) return { ok: false };
  revalidatePath("/shop");
  redirect("/shop?view=orders");
}

/** MG9: «Свой курс» (empty = back to NBP). */
export async function setOwnRateAction(input: string): Promise<{ ok: boolean }> {
  try {
    const ok = await setOwnEurRate(await shopOrdersRepository(), input);
    if (ok) revalidatePath("/shop");
    return { ok };
  } catch {
    return { ok: false };
  }
}
