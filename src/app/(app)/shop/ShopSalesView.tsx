import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { card, ui } from "@/app/components/ui";
import { nextMonth, previousMonth } from "@/logic/rules/consumption";
import type { ShopProduct, ShopSales } from "@/logic/rules/shop";
import { ReturnSaleButton } from "./ReturnSaleButton";

/** MG3 «Продажи»: a month – pieces and value per currency, per brand and product. */
export async function ShopSalesView({
  sales,
  products,
  orders,
  current,
}: {
  sales: ShopSales;
  products: ShopProduct[];
  orders: Record<string, { buyerId: string; buyerName: string; handed: boolean }>;
  current: string;
}) {
  const t = await getTranslations("shop");
  const locale = await getLocale();
  const byId = new Map(products.map((p) => [p.id, p]));
  const money = (value: number, currency: string) => new Intl.NumberFormat(locale, { style: "currency", currency, currencyDisplay: "narrowSymbol", maximumFractionDigits: 2 }).format(value);
  const monthName = (month: string) => {
    const [y, m] = month.split("-").map(Number);
    const name = new Intl.DateTimeFormat(locale, { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 1)));
    return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${y}`;
  };
  const totals = (["PLN", "EUR"] as const).filter((c) => sales.value[c] > 0).map((c) => money(sales.value[c], c));
  const groups = new Map<string, typeof sales.rows>();
  for (const r of sales.rows) {
    const brand = byId.get(r.productId)?.brand ?? "—";
    groups.set(brand, [...(groups.get(brand) ?? []), r]);
  }

  return (
    <div className="flex flex-col gap-4">
      <nav aria-label={t("monthLabel")} className="flex items-center justify-between gap-2">
        <Link href={`/shop?view=sales&month=${previousMonth(sales.month)}`} className={`${ui.textButton} px-3 text-2xl`} aria-label={t("previous")}>
          ‹
        </Link>
        <h2 className="font-serif text-2xl text-ink">{monthName(sales.month)}</h2>
        {sales.month < current ? (
          <Link href={`/shop?view=sales&month=${nextMonth(sales.month)}`} className={`${ui.textButton} px-3 text-2xl`} aria-label={t("next")}>
            ›
          </Link>
        ) : (
          <span aria-hidden className="min-h-11 px-3" />
        )}
      </nav>
      <section className={`${card.surface} flex flex-col gap-1 p-4`}>
        <span className={ui.muted}>{t("sold")}</span>
        <span className="text-xl font-semibold text-ink">
          {t("pieces", { count: sales.pieces })}
          {totals.length > 0 && ` · ${totals.join(" / ")}`}
        </span>
      </section>
      {sales.rows.length === 0 && <p className={`${card.surface} px-5 py-10 text-center ${ui.muted}`}>{t("noSales")}</p>}
      {[...groups.entries()].map(([brand, rows]) => (
        <section key={brand} className="flex flex-col gap-2">
          <h3 className="px-1 text-sm font-semibold text-muted">{brand}</h3>
          <ul className={`${card.surface} flex flex-col`}>
            {rows.map((r) => {
              const p = byId.get(r.productId);
              const order = r.orderId ? orders[r.orderId] : undefined;
              return (
                <li key={`${r.productId}:${r.currency}:${r.orderId ?? ""}`} className="flex flex-col gap-1 border-b border-line px-4 py-3 last:border-b-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 break-words text-base text-ink">
                      {p?.name ?? "—"}
                      {p?.size && <span className="text-muted"> · {p.size}</span>}
                    </span>
                    <span className="shrink-0 text-right text-base text-ink">
                      {t("pieces", { count: r.quantity })} · {money(r.value, r.currency)}
                    </span>
                  </div>
                  {r.orderId ? (
                    <Link
                      href={order && !order.handed ? `/shop/orders/${r.orderId}/edit` : `/shop?view=orders${order ? `&buyer=${order.buyerId}` : ""}`}
                      className={`${ui.textButton} self-start text-sm`}
                    >
                      {t(order && !order.handed ? "inOrderEdit" : "inOrder", { name: order?.buyerName ?? "—" })}
                    </Link>
                  ) : (
                    <ReturnSaleButton productId={r.productId} month={sales.month} currency={r.currency} name={p?.name ?? ""} />
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
