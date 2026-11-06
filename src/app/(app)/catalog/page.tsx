import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { BrandMark } from "@/app/components/Brand";
import { ui } from "@/app/components/ui";
import type { Locale } from "@/config/locales";
import { catalogRepository } from "@/data/repositories/server";
import { localized } from "@/logic/rules/catalog-settings";
import { getCatalogOverview, type CatalogOverview } from "@/logic/usecases/catalog";
import { CatalogView } from "./CatalogView";
import { CatalogSwitch } from "./CatalogSwitch";
import { ConsumptionView } from "./ConsumptionView";
import { practiceTimeZone } from "@/config/time";
import { consumptionRepository } from "@/data/repositories/server";
import { monthOf } from "@/logic/rules/consumption";
import { todayIn } from "@/logic/rules/dates";
import { getConsumption } from "@/logic/usecases/consumption";
import { getStockOverview } from "@/logic/usecases/stock";
import { stockDeps } from "./stock/deps";
import { StockView } from "./StockView";

export async function CatalogPageView({ overview }: { overview: CatalogOverview }) {
  const t = await getTranslations("catalog");
  const locale = (await getLocale()) as Locale;
  const typeName = new Map(overview.types.map(({ type }) => [type.id, localized(type.name, locale)]));
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-5 pt-2 pb-8">
      <header className="flex items-center justify-between gap-4 pt-2">
        <BrandMark />
        <Link href="/catalog/preparations/new" className={ui.addButton}>
          {t("newPreparation")}
        </Link>
      </header>
      <h1 className="font-serif text-5xl leading-tight text-ink">{t("title")}</h1>
      <CatalogSwitch current="catalog" />
      <CatalogView
        types={overview.types.map(({ type, preparationCount, missing }) => ({
          id: type.id,
          name: typeName.get(type.id)!,
          preparationCount,
          missing: missing.length > 0,
        }))}
        preparations={overview.preparations.map((p) => ({
          id: p.id,
          name: p.name,
          manufacturer: p.manufacturer,
          favorite: p.favorite,
          typeName: typeName.get(p.procedureTypeId) ?? "",
        }))}
      />
    </main>
  );
}

/** «Препараты»: the catalogue, SK1 «Склад» (?view=stock) or RS1 «Расход» (?view=usage&month=2026-11). */
export default async function CatalogPage({ searchParams }: { searchParams: Promise<{ view?: string; month?: string }> }) {
  const { view, month } = await searchParams;
  if (view === "stock") return <StockView lines={await getStockOverview(await stockDeps(), todayIn(practiceTimeZone))} />;
  if (view === "usage") {
    const today = todayIn(practiceTimeZone);
    return <ConsumptionView data={await getConsumption(await consumptionRepository(), month, today)} current={monthOf(today)} />;
  }
  return <CatalogPageView overview={await getCatalogOverview(await catalogRepository())} />;
}
