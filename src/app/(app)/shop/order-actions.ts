"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { withSaved } from "@/logic/rules/saved";
import { practiceTimeZone } from "@/config/time";
import { fetchNbpEurRate } from "@/data/nbp";
import { shopOrdersRepository, shopRepository } from "@/data/repositories/server";
import { todayIn } from "@/logic/rules/dates";
import { sellToBuyer, undoSaleToBuyer } from "@/logic/usecases/shop-orders";
import { addPayment, cancelOrder, deletePayment, getEurRate, giveReceiptToOrder, saveOrder, setOrderHandedOver, setOwnEurRate, type OrderErrors, type OrderFormInput } from "@/logic/usecases/shop-orders";

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
  redirect(withSaved(`/shop?view=orders&new=${result.id}`));
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

/** MG10: «+» → «Для какого заказа?» → this order. */
export async function giveReceiptAction(orderItemId: string): Promise<{ ok: boolean }> {
  try {
    const ok = await giveReceiptToOrder(await shopOrdersRepository(), orderItemId, todayIn(practiceTimeZone));
    if (ok) revalidatePath("/shop");
    return { ok };
  } catch {
    return { ok: false };
  }
}

/** MG11 «Оплата»; the id is for «Отменить». */
export async function addPaymentAction(orderId: string, amount: string): Promise<{ ok: boolean; id?: string }> {
  try {
    const id = await addPayment(await shopOrdersRepository(), orderId, amount, todayIn(practiceTimeZone));
    if (id) revalidatePath("/shop");
    return { ok: Boolean(id), id: id ?? undefined };
  } catch {
    return { ok: false };
  }
}

/** MG11: a payment entered by mistake. */
export async function deletePaymentAction(paymentId: string): Promise<{ ok: boolean }> {
  try {
    const ok = await deletePayment(await shopOrdersRepository(), paymentId);
    if (ok) revalidatePath("/shop");
    return { ok };
  } catch {
    return { ok: false };
  }
}

/** MG14 «−» → «Да, продан» → «Кому?» → this buyer. */
export async function sellToBuyerAction(
  productId: string,
  buyer: { buyerId?: string | null; name?: string; phone?: string; instagram?: string },
): Promise<{ ok: boolean; reason?: "empty" | "noRate"; orderId?: string }> {
  try {
    const orders = await shopOrdersRepository();
    const { rate } = await getEurRate(orders, fetchNbpEurRate);
    const result = await sellToBuyer(await shopRepository(), orders, productId, buyer, todayIn(practiceTimeZone), rate);
    if (result.status === "ok") revalidatePath("/shop");
    return { ok: result.status === "ok", reason: result.status === "empty" || result.status === "noRate" ? result.status : undefined, orderId: result.orderId };
  } catch {
    return { ok: false };
  }
}

/** UX3 «Отменить» right after «Кому?». */
export async function undoSaleToBuyerAction(orderId: string): Promise<{ ok: boolean }> {
  try {
    const ok = await undoSaleToBuyer(await shopOrdersRepository(), orderId);
    if (ok) revalidatePath("/shop");
    return { ok };
  } catch {
    return { ok: false };
  }
}
