"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { locales } from "@/config/locales";
import { setLocale } from "@/app/actions";

export function LanguageSelect() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <select
      aria-label={t("common.language")}
      value={locale}
      disabled={pending}
      onChange={(e) =>
        startTransition(async () => {
          await setLocale(e.target.value);
          router.refresh();
        })
      }
      className="min-h-11 rounded-[14px] border border-field bg-transparent px-3 text-sm text-ink"
    >
      {locales.map((l) => (
        <option key={l} value={l}>
          {t(`language.${l}`)}
        </option>
      ))}
    </select>
  );
}
