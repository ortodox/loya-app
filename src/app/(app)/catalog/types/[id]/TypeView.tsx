import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { card, pill, ui } from "@/app/components/ui";
import type { Locale } from "@/config/locales";
import { hasAdvice, localized } from "@/logic/rules/catalog-settings";
import type { TypeDetail } from "@/logic/usecases/catalog";
import { AdviceView } from "../../AdviceView";
import { SettingsRows } from "../../SettingsRows";

export async function TypeView({ detail }: { detail: TypeDetail }) {
  const t = await getTranslations("catalog");
  const locale = (await getLocale()) as Locale;
  const { type, zones, preparations } = detail;
  const allowed = zones.filter((z) => type.zoneIds.includes(z.id));

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-5 pt-2 pb-8">
      <nav className="flex items-center justify-between">
        <Link href="/catalog" className={ui.textButton}>
          ‹ {t("backToCatalog")}
        </Link>
        <Link href={`/catalog/types/${type.id}/edit`} className={ui.textButton}>
          {t("edit")}
        </Link>
      </nav>

      <header className="flex flex-col gap-1">
        <p className="text-xs font-semibold tracking-[0.25em] text-muted uppercase">{t("fields.type")}</p>
        <h1 className="font-serif text-4xl leading-tight text-ink">{localized(type.name, locale)}</h1>
      </header>

      <section className={`${card.surface} flex flex-col gap-3 p-4`}>
        <h2 className={card.heading}>{t("zones")}</h2>
        {allowed.length === 0 ? (
          <span className={`${ui.alertTag} self-start`}>{t("toFill")}</span>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {allowed.map((z) => (
              <li key={z.id} className={`${pill.base} ${pill.off}`}>
                {localized(z.name, locale)}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={card.surface}>
        <h2 className={`${card.heading} px-4 pt-4`}>{t("defaults")}</h2>
        <p className="px-4 pt-1 text-sm text-muted">{t("defaultsHint")}</p>
        <SettingsRows settings={type} />
      </section>

      <section className={`${card.surface} flex flex-col gap-3 p-4`}>
        <h2 className={card.heading}>{t("fields.advice")}</h2>
        {hasAdvice(type.advice) ? <AdviceView settings={type} /> : <span className={`${ui.alertTag} self-start`}>{t("toFill")}</span>}
      </section>

      <section className={card.surface}>
        <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-2">
          <h2 className={card.heading}>{t("preparations")}</h2>
          <Link
            href={`/catalog/preparations/new?type=${type.id}`}
            className="inline-flex min-h-11 items-center rounded-full bg-primary px-4 text-sm font-semibold text-on-primary"
          >
            {t("newPreparation")}
          </Link>
        </div>
        {preparations.length === 0 ? (
          <p className={`${ui.muted} px-4 pb-4`}>{t("noPreparations")}</p>
        ) : (
          <ul>
            {preparations.map((p) => (
              <li key={p.id} className="border-t border-line">
                <Link href={`/catalog/preparations/${p.id}`} className="flex min-h-11 items-center gap-3 px-4 py-3">
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-base font-semibold text-ink">
                      {p.favorite && <span aria-label={t("favoriteMark")}>⭐ </span>}
                      {p.name}
                    </span>
                    {p.manufacturer && <span className="text-sm text-muted">{p.manufacturer}</span>}
                  </span>
                  <span aria-hidden className="text-muted">
                    ›
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
