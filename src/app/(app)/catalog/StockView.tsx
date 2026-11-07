import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { BrandMark } from "@/app/components/Brand";
import { reminderTypeLabel } from "@/app/components/reminderType";
import { card, ui } from "@/app/components/ui";
import type { Locale } from "@/config/locales";
import { formatIsoDate } from "@/logic/rules/dates";
import type { StockLine } from "@/logic/usecases/stock";
import { CatalogSwitch } from "./CatalogSwitch";
import { DiscardVial } from "./stock/DiscardVial";
import { StockHistory } from "./stock/StockHistory";

/** SK1 «Склад»: the preparations Loya keeps in stock, by type – no client names. */
export async function StockView({ lines }: { lines: StockLine[] }) {
  const t = await getTranslations();
  const locale = (await getLocale()) as Locale;
  const fmt = (n: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(n);
  const unit = (l: StockLine) => t(l.kind === "vials" ? "stock.units" : "stock.pieces");
  const groups = new Map<string, { label: string; lines: StockLine[] }>();
  for (const l of lines) {
    const key = l.type?.id ?? "none";
    const group = groups.get(key) ?? { label: reminderTypeLabel((k) => t(`reminders.${k}`), l.type, locale), lines: [] };
    group.lines.push(l);
    groups.set(key, group);
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-5 pt-2 pb-8">
      <header className="flex items-center justify-between gap-4 pt-2">
        <BrandMark />
        <Link href="/catalog/stock/new" className={ui.addButton}>
          {t("stock.add")}
        </Link>
      </header>
      <h1 className="font-serif text-5xl leading-tight text-ink">{t("catalog.title")}</h1>
      <CatalogSwitch current="stock" />

      {lines.length === 0 && (
        <section className={`${card.surface} flex flex-col gap-3 p-5`}>
          <h2 className={card.heading}>{t("stock.howTitle")}</h2>
          <ol className="flex list-decimal flex-col gap-2 pl-5 text-base text-ink">
            <li>{t("stock.how1")}</li>
            <li>{t("stock.how2")}</li>
            <li>{t("stock.how3")}</li>
          </ol>
          <Link href="/catalog/stock/new" className={ui.button}>
            {t("stock.add")}
          </Link>
        </section>
      )}

      {[...groups.entries()].map(([key, g]) => (
        <section key={key} className="flex flex-col gap-2">
          <h2 className="px-1 text-sm font-semibold text-muted">{g.label}</h2>
          <ul className={`${card.surface} flex flex-col`}>
            {g.lines.map((l) => (
              <li key={l.itemId} className="flex flex-col gap-2 border-b border-line px-4 py-3 last:border-b-0">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate text-base font-semibold text-ink">{l.name}</span>
                  <span className="shrink-0 text-right text-base font-semibold text-ink">
                    {fmt(l.state.available)} {unit(l)}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-3 text-sm text-muted">
                  <span>{t("stock.inStock")}</span>
                  <span className="text-right">
                    {t("stock.afterPlanned")}: ~{fmt(l.afterPlanned)} {unit(l)}
                  </span>
                </div>
                {l.kind === "vials" && (
                  <ul className="flex flex-col">
                    {l.state.openVials.map((v) => {
                      const label = t("stock.openVial", { date: formatIsoDate(v.openedOn), amount: fmt(v.remaining), size: v.size });
                      return (
                        <li key={v.key} className="flex items-center justify-between gap-3 text-sm text-ink">
                          <span>{label}</span>
                          <DiscardVial itemId={l.itemId} vialKey={v.key} label={label} />
                        </li>
                      );
                    })}
                    {l.state.closed.length > 0 && (
                      <li className="text-sm text-ink">
                        {t("stock.closed")}: {l.state.closed.map((c) => `${c.count} × ${c.size} ${unit(l)}`).join(", ")}
                      </li>
                    )}
                  </ul>
                )}
                {l.state.unknown + l.plannedUnknown > 0 && (
                  <span className="text-xs text-on-alert">{t("stock.unknown", { count: l.state.unknown + l.plannedUnknown })}</span>
                )}
                <div className="flex gap-4">
                  <Link href={`/catalog/stock/${l.itemId}/receipts/new`} className={ui.textButton}>
                    {t("stock.receive")}
                  </Link>
                  <Link href={`/catalog/stock/${l.itemId}/edit`} className={ui.textButton}>
                    {t("stock.correct")}
                  </Link>
                </div>
                <StockHistory entries={l.state.history} unit={unit(l)} />
              </li>
            ))}
          </ul>
        </section>
      ))}

      {lines.length > 0 && <p className="text-xs text-muted">{t("stock.hint")}</p>}
    </main>
  );
}
