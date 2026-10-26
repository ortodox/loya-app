import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { card, ui } from "@/app/components/ui";
import type { Locale } from "@/config/locales";
import { hasAdvice, localized } from "@/logic/rules/catalog-settings";
import type { PreparationDetail } from "@/logic/usecases/catalog";
import { AdviceView } from "../../AdviceView";
import { SettingsRows } from "../../SettingsRows";

export async function PreparationView({ detail }: { detail: PreparationDetail }) {
  const t = await getTranslations("catalog");
  const locale = (await getLocale()) as Locale;
  const { preparation, type, effective } = detail;
  const typeName = localized(type.name, locale);
  const adviceOwn = effective.source.advice === "preparation";

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-5 pt-2 pb-8">
      <nav className="flex items-center justify-between gap-3">
        <Link href={`/catalog/types/${type.id}`} className={`${ui.textButton} min-w-0 truncate`}>
          ‹ {typeName}
        </Link>
        <Link href={`/catalog/preparations/${preparation.id}/edit`} className={ui.textButton}>
          {t("edit")}
        </Link>
      </nav>

      <header className="flex flex-col gap-1">
        <p className="text-xs font-semibold tracking-[0.25em] text-muted uppercase">{typeName}</p>
        <h1 className="font-serif text-4xl leading-tight text-ink">
          {preparation.favorite && <span aria-label={t("favoriteMark")}>⭐ </span>}
          {preparation.name}
        </h1>
        {preparation.manufacturer && <p className="text-sm text-muted">{preparation.manufacturer}</p>}
      </header>

      <section className={card.surface}>
        <h2 className={`${card.heading} px-4 pt-4`}>{t("ownValues")}</h2>
        <p className="px-4 pt-1 text-sm text-muted">{t("ownValuesHint")}</p>
        <SettingsRows settings={effective.settings} source={effective.source} />
      </section>

      <section className={`${card.surface} flex flex-col gap-3 p-4`}>
        <div className="flex items-center justify-between gap-3">
          <h2 className={card.heading}>{t("fields.advice")}</h2>
          <span className={adviceOwn ? "text-xs font-semibold text-accent" : "text-xs text-muted"}>
            {adviceOwn ? t("own") : t("fromType")}
          </span>
        </div>
        {hasAdvice(effective.settings.advice) ? (
          <AdviceView settings={effective.settings} />
        ) : (
          <span className={`${ui.alertTag} self-start`}>{t("toFill")}</span>
        )}
      </section>
    </main>
  );
}
