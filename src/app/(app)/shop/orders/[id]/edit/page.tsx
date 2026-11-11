import { getLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { fetchNbpEurRate } from "@/data/nbp";
import { shopOrdersRepository, shopRepository } from "@/data/repositories/server";
import { getEurRate, getOrderForm } from "@/logic/usecases/shop-orders";
import { OrderForm } from "../../../OrderForm";

export const dynamic = "force-dynamic";

/** MG9/MG12 «Изменить» – only while the order is waiting; also «Отменить заказ». */
export default async function EditOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const orders = await shopOrdersRepository();
  const { rate } = await getEurRate(orders, fetchNbpEurRate);
  const form = await getOrderForm(await shopRepository(), orders, id, rate);
  if (!form) notFound();
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-2 pb-8">
      <OrderForm {...form} rate={rate} locale={await getLocale()} />
    </main>
  );
}
