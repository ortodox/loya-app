"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { ui } from "@/app/components/ui";
import { matchesName } from "@/logic/rules/client-list";
import { flagEmoji } from "@/logic/rules/country";
import { formatIsoDate } from "@/logic/rules/dates";
import type { ClientSummary } from "@/logic/usecases/clients";

type Props = {
  clients: ClientSummary[];
  /** Country names by ISO code, built on the server (browser ICU data may differ). */
  countryNames: Record<string, string>;
};

export function ClientList({ clients, countryNames }: Props) {
  const t = useTranslations("clients");
  const [query, setQuery] = useState("");
  const shown = clients.filter((c) => matchesName(c.fullName, query));

  if (clients.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16 text-center">
        <p className={ui.muted}>{t("empty")}</p>
        <Link href="/clients/new" className={`${ui.button} max-w-xs`}>
          {t("emptyCta")}
        </Link>
      </div>
    );
  }

  return (
    <>
      <ul className="flex flex-col pb-28">
        {shown.map((c) => (
          <li key={c.id} className="border-b border-neutral-200 last:border-b-0 dark:border-neutral-800">
            <Link href={`/clients/${c.id}`} className="flex flex-col gap-0.5 py-3">
              <span className="truncate text-base font-semibold">{c.fullName}</span>
              <span className="flex gap-2 text-sm text-neutral-500 dark:text-neutral-400">
                <span className="shrink-0">{formatIsoDate(c.date)}</span>
                {c.age !== null && <span className="shrink-0">{t("age", { age: c.age })}</span>}
                {/* PR5: country of residence. */}
                {c.residenceCountry && (
                  <span className="shrink-0">
                    {flagEmoji(c.residenceCountry)} {countryNames[c.residenceCountry]}
                  </span>
                )}
                <span className="truncate">{c.excerpt}</span>
              </span>
            </Link>
          </li>
        ))}
        {shown.length === 0 && <li className={`${ui.muted} py-6 text-center`}>{t("noResults")}</li>}
      </ul>

      {/* Search at the bottom, like Apple Notes. */}
      <div className="fixed inset-x-0 bottom-0 border-t border-neutral-200 bg-white/90 px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur dark:border-neutral-800 dark:bg-black/90">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <input
            type="search"
            enterKeyHint="search"
            placeholder={t("search")}
            aria-label={t("search")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-xl bg-neutral-100 px-4 py-2.5 text-base outline-none dark:bg-neutral-900"
          />
          <Link
            href="/clients/new"
            aria-label={t("new")}
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-2xl leading-none text-white dark:bg-neutral-100 dark:text-neutral-900"
          >
            +
          </Link>
        </div>
      </div>
    </>
  );
}
