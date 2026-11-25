import { useTranslations } from "next-intl";
import type { ProfitSplit } from "@/logic/rules/shop-orders";

/**
 * MG20/MG22: «💼 Отложить на закупку» and «💰 Твоя прибыль» – for one order or the month's «Итог».
 * Pieces without a purchase price kept at the time of the sale: «Не посчитано: N шт». Only Loya sees it.
 */
export function ProfitBlock({ money, locale }: { money: ProfitSplit; locale: string }) {
  const t = useTranslations("shop.money");
  const zl = (v: number) => new Intl.NumberFormat(locale, { style: "currency", currency: "PLN", currencyDisplay: "narrowSymbol", maximumFractionDigits: 2 }).format(v);
  const counted = money.cost > 0 || money.profit !== 0;
  return (
    <div className="flex flex-col gap-1">
      {counted && (
        <>
          <span className="flex items-baseline justify-between gap-2 text-base text-ink">
            <span>💼 {t("putAside")}</span>
            <span className="font-semibold tabular-nums">{zl(money.cost)}</span>
          </span>
          <span className="flex items-baseline justify-between gap-2 text-base text-ink">
            <span>💰 {t("profit")}</span>
            <span className={`font-semibold tabular-nums ${money.profit < 0 ? "text-on-alert" : ""}`}>{zl(money.profit)}</span>
          </span>
        </>
      )}
      {money.uncounted > 0 && <span className="text-sm text-muted">{t("uncounted", { count: money.uncounted })}</span>}
    </div>
  );
}
