"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { card, ui } from "@/app/components/ui";
import { matchesName } from "@/logic/rules/client-list";
import { formatIsoDate } from "@/logic/rules/dates";
import type { ClientSummary } from "@/logic/usecases/clients";

export function ClientList({ clients }: { clients: ClientSummary[] }) {
  const t = useTranslations("clients");
  const [query, setQuery] = useState("");
  const shown = clients.filter((c) => matchesName(c.fullName, query));

  if (clients.length === 0) {
    return (
      <div className={`${card.surface} flex flex-col items-center gap-4 px-5 py-12 text-center`}>
        <p className={ui.muted}>{t("empty")}</p>
        <Link href="/clients/new" className={`${ui.button} max-w-xs`}>
          {t("emptyCta")}
        </Link>
      </div>
    );
  }

  return (
    <>
      <input
        type="search"
        enterKeyHint="search"
        placeholder={t("search")}
        aria-label={t("search")}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className={ui.input}
      />
      <ul className={`${card.surface} flex flex-col`}>
        {shown.map((c) => (
          <li key={c.id} className="border-b border-line last:border-b-0">
            <Link href={`/clients/${c.id}`} className="flex min-h-11 items-start gap-3 px-4 py-3">
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-base font-semibold text-ink">{c.fullName}</span>
                <span className="text-sm text-muted">
                  {formatIsoDate(c.date)}
                  {c.age !== null && ` · ${t("age", { age: c.age })}`}
                </span>
                {c.excerpt && <span className="truncate text-sm text-muted">{c.excerpt}</span>}
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1 pt-0.5">
                {/* PR5: country code; AL2: allergy tag. */}
                {c.residenceCountry && <span className={ui.tag}>{c.residenceCountry}</span>}
                {c.allergy && <span className={ui.alertTag}>{t("allergyTag")}</span>}
              </span>
            </Link>
          </li>
        ))}
        {shown.length === 0 && <li className={`${ui.muted} px-4 py-6 text-center`}>{t("noResults")}</li>}
      </ul>

    </>
  );
}
