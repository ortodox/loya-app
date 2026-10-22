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
      className="rounded-lg border border-neutral-300 bg-transparent px-2 py-1 text-sm dark:border-neutral-700"
    >
      {locales.map((l) => (
        <option key={l} value={l}>
          {t(`language.${l}`)}
        </option>
      ))}
    </select>
  );
}
