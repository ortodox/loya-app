import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { card, ui } from "@/app/components/ui";
import type { ShopBuyer, EurRate } from "@/logic/rules/shop-orders";
import type { OrderView } from "@/logic/usecases/shop-orders";
import { BuyerContacts } from "./BuyerContacts";
import { OrderCard } from "./OrderCard";
import { RateForm } from "./RateForm";

type Props = {
  waiting: OrderView[];
  unpaid: OrderView[];
  done: OrderView[];
  buyer: ShopBuyer | null;
  rate: { rate: EurRate | null; own: number | null; nbp: { rate: number; date: string } | null };
  locale: string;
};

/** MG9–MG12 «Заказы»: waiting for hand-over, handed over but not paid, done; one buyer's orders when chosen. */
export async function OrdersView({ waiting, unpaid, done, buyer, rate, locale }: Props) {
  const t = await getTranslations("shop.orders");
  return (
    <div className="flex flex-col gap-4">
      {buyer ? (
        <section className={`${card.surface} flex flex-col gap-2 p-4`}>
          <Link href="/shop?view=orders" className={`${ui.textButton} text-sm`}>
            ‹ {t("allOrders")}
          </Link>
          <h2 className={card.heading}>{buyer.name}</h2>
          <BuyerContacts buyer={buyer} />
        </section>
      ) : (
        <RateForm own={rate.own} nbp={rate.nbp} locale={locale} />
      )}
      <section className="flex flex-col gap-2">
        <h2 className="px-1 text-sm font-semibold text-muted">
          {t("waiting")} ({waiting.length})
        </h2>
        {waiting.length === 0 ? (
          <p className={`${card.surface} px-5 py-6 text-center ${ui.muted}`}>{t("noneWaiting")}</p>
        ) : (
          waiting.map((o) => <OrderCard key={o.id} order={o} locale={locale} />)
        )}
      </section>
      {[["unpaid", unpaid] as const, ["done", done] as const].map(([key, list]) =>
        list.length > 0 ? (
          <section key={key} className="flex flex-col gap-2">
            <h2 className="px-1 text-sm font-semibold text-muted">
              {t(key)} ({list.length})
            </h2>
            {list.slice(0, 50).map((o) => (
              <OrderCard key={o.id} order={o} locale={locale} />
            ))}
          </section>
        ) : null,
      )}
    </div>
  );
}
