import { getLocale } from "next-intl/server";
import { fetchNbpEurRate } from "@/data/nbp";
import { shopOrdersRepository, shopRepository } from "@/data/repositories/server";
import { getEurRate, getOrderForm } from "@/logic/usecases/shop-orders";
import { OrderForm } from "../../OrderForm";

export const dynamic = "force-dynamic";

/** MG9 «+ Заказ». */
export default async function NewOrderPage() {
  const orders = await shopOrdersRepository();
  const { rate } = await getEurRate(orders, fetchNbpEurRate);
  const form = (await getOrderForm(await shopRepository(), orders, null, rate))!;
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-2 pb-8">
      <OrderForm {...form} rate={rate} locale={await getLocale()} />
    </main>
  );
}
