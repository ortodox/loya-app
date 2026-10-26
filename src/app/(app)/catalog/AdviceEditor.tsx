"use client";

import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/config/locales";
import type { Localized } from "@/logic/catalog";
import { ui } from "@/app/components/ui";
import { LanguageTabs } from "./LanguageTabs";

/**
 * S2/P5: advice per language (one recommendation per line) with a «требует проверки» box.
 * `inherited` (on a preparation) is shown as a grey placeholder: leaving the text empty uses it.
 */
export function AdviceEditor({
  advice,
  review,
  inherited,
}: {
  advice: Localized;
  review: string[];
  inherited?: Localized | null;
}) {
  const t = useTranslations("catalog");
  const locale = useLocale() as Locale;
  return (
    <LanguageTabs initial={locale} flagged={(review as Locale[]).filter((l) => advice[l])}>
      {(l) => (
        <div className="flex flex-col gap-2">
          <textarea
            name={`advice.${l}`}
            rows={7}
            defaultValue={advice[l] ?? ""}
            placeholder={inherited?.[l] ?? ""}
            aria-label={`${t("fields.advice")} ${l.toUpperCase()}`}
            className={ui.input}
          />
          {/* Russian is the original; only translations can need review. */}
          {l !== "ru" && (
            <label className="flex min-h-11 items-center gap-3 text-sm text-ink">
              <input
                type="checkbox"
                name="adviceReview"
                value={l}
                defaultChecked={review.includes(l)}
                className="size-5 accent-[var(--accent)]"
              />
              {t("reviewCheckbox")}
            </label>
          )}
        </div>
      )}
    </LanguageTabs>
  );
}
