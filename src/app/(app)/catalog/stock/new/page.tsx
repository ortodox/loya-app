import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { reminderTypeLabel } from "@/app/components/reminderType";
import { card, ui } from "@/app/components/ui";
import type { Locale } from "@/config/locales";
import { listAddablePreparations } from "@/logic/usecases/stock";
import { stockDeps } from "../deps";

/** SK1 «+ На склад»: Loya picks which catalogue preparations are kept in stock. */
export default async function AddToStockPage() {
  const t = await getTranslations();
  const locale = (await getLocale()) as Locale;
  const list = await listAddablePreparations(await stockDeps());
  const groups = new Map<string, { label: string; items: typeof list }>();
  for (const p of list) {
    const key = p.type?.id ?? "none";
    const group = groups.get(key) ?? { label: reminderTypeLabel((k) => t(`reminders.${k}`), p.type, locale), items: [] };
    group.items.push(p);
    groups.set(key, group);
  }
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-5 pt-2 pb-8">
      <header className="flex items-center justify-between gap-4">
        <Link href="/catalog?view=stock" className={ui.textButton}>
          {t("form.cancel")}
        </Link>
        <h1 className="text-center font-serif text-2xl text-ink">{t("stock.addTitle")}</h1>
        <span className="min-w-16" aria-hidden />
      </header>
      <p className={ui.muted}>{t("stock.addIntro")}</p>
      {list.length === 0 && <p className={`${card.surface} px-5 py-10 text-center ${ui.muted}`}>{t("stock.allAdded")}</p>}
      {[...groups.entries()].map(([key, g]) => (
        <section key={key} className="flex flex-col gap-2">
          <h2 className="px-1 text-sm font-semibold text-muted">{g.label}</h2>
          <ul className={`${card.surface} flex flex-col`}>
            {g.items.map((p) => (
              <li key={p.id} className="border-b border-line last:border-b-0">
                <Link href={`/catalog/stock/new/${p.id}`} className="flex min-h-11 items-center justify-between gap-3 px-4 py-3 text-base text-ink">
                  <span className="min-w-0 truncate font-semibold">{p.name}</span>
                  <span className="shrink-0 text-sm text-muted">{t(p.botox ? "stock.inVials" : "stock.inPieces")} ›</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
