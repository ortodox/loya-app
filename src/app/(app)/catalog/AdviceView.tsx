"use client";

import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/config/locales";
import type { CatalogSettings } from "@/logic/catalog";
import { adviceLines, needsReview } from "@/logic/rules/catalog-settings";
import { ui } from "@/app/components/ui";
import { LanguageTabs } from "./LanguageTabs";

/** S2: advice per language, with «требует проверки» on unchecked translations. */
export function AdviceView({ settings }: { settings: CatalogSettings }) {
  const t = useTranslations("catalog");
  const locale = useLocale() as Locale;
  const flagged = (["ru", "uk", "pl", "en"] as Locale[]).filter((l) => needsReview(settings, l));
  return (
    <LanguageTabs initial={locale} flagged={flagged}>
      {(l) => {
        const lines = adviceLines(settings.advice, l);
        return (
          <div className="flex flex-col gap-2">
            {needsReview(settings, l) && <span className={`${ui.alertTag} self-start`}>{t("needsReview")}</span>}
            {lines.length === 0 ? (
              <p className={ui.muted}>{t("noAdvice")}</p>
            ) : (
              <ul className="flex list-disc flex-col gap-1.5 pl-5 text-base text-ink marker:text-gold">
                {lines.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            )}
          </div>
        );
      }}
    </LanguageTabs>
  );
}
