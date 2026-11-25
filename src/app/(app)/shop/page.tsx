import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { BrandMark } from "@/app/components/Brand";
import { ui } from "@/app/components/ui";
import { practiceTimeZone } from "@/config/time";
import { shopRepository } from "@/data/repositories/server";
import { monthOf } from "@/logic/rules/consumption";
import { todayIn } from "@/logic/rules/dates";
import { getFreeStock, getShop, getShopSales } from "@/logic/usecases/shop";
import { fetchNbpEurRate } from "@/data/nbp";
import { shopOrdersRepository } from "@/data/repositories/server";
import { getEurRate, getOrders, getWhoWaits, listBuyers } from "@/logic/usecases/shop-orders";
import { OrdersView } from "./OrdersView";
import { ShopList } from "./ShopList";
import { ShopSalesView } from "./ShopSalesView";
import { ShopSwitch, type ShopView } from "./ShopSwitch";

export const dynamic = "force-dynamic";

/** MG1–MG4, MG9 «Магазин»: «Каталог | Склад | Заказы | Продажи» (?view=…); «Склад» first – what is in stock. */
export default async function ShopPage({ searchParams }: { searchParams: Promise<{ view?: string; month?: string; buyer?: string; new?: string }> }) {
  const { view: asked, month, buyer, new: created } = await searchParams;
  const view: ShopView = asked === "catalog" || asked === "sales" || asked === "orders" ? asked : "stock";
  const t = await getTranslations("shop");
  const locale = await getLocale();
  const repo = await shopRepository();
  const today = todayIn(practiceTimeZone);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-5 pt-2 pb-8">
      <header className="flex items-center justify-between gap-4 pt-2">
        <BrandMark />
        {view === "orders" ? (
          <Link href="/shop/orders/new" className={ui.addButton}>
            {t("orders.new")}
          </Link>
        ) : (
          <Link href="/shop/products/new" className={ui.addButton}>
            {t("newProduct")}
          </Link>
        )}
      </header>
      <h1 className="font-serif text-5xl leading-tight text-ink">{t("title")}</h1>
      <ShopSwitch current={view} />
      {view === "orders" ? (
        await (async () => {
          const orders = await shopOrdersRepository();
          const [list, rate, free] = await Promise.all([getOrders(repo, orders, buyer && /^[0-9a-f-]{36}$/i.test(buyer) ? buyer : null), getEurRate(orders, fetchNbpEurRate), getFreeStock(repo)]);
          return <OrdersView {...list} rate={rate} free={free} locale={locale} today={today} highlight={created && /^[0-9a-f-]{36}$/i.test(created) ? created : null} />;
        })()
      ) : view === "sales" ? (
        await (async () => {
          const orders = await shopOrdersRepository();
          const eurRate = (await getEurRate(orders, fetchNbpEurRate)).rate?.rate ?? null;
          return <ShopSalesView {...(await getShopSales(repo, month, today, orders, eurRate))} current={monthOf(today)} eurRate={eurRate} />;
        })()
      ) : (
        <ShopList key={view} mode={view} locale={locale} today={today} {...(await getShop(repo))} waits={view === "stock" ? await getWhoWaits(await shopOrdersRepository()) : {}} buyers={view === "stock" ? await listBuyers(await shopOrdersRepository()) : []} eurRate={(await getEurRate(await shopOrdersRepository(), fetchNbpEurRate)).rate?.rate ?? null} />
      )}
    </main>
  );
}
