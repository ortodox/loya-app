"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { card, ui } from "@/app/components/ui";
import { matchesPreparation } from "@/logic/rules/catalog-list";

export type CatalogTypeRow = { id: string; name: string; preparationCount: number; missing: boolean };
export type CatalogPreparationRow = {
  id: string;
  name: string;
  manufacturer: string | null;
  favorite: boolean;
  typeName: string;
};

/** B1: procedure types; P1: search across all preparations. */
export function CatalogView({ types, preparations }: { types: CatalogTypeRow[]; preparations: CatalogPreparationRow[] }) {
  const t = useTranslations("catalog");
  const [query, setQuery] = useState("");
  const found = query.trim() ? preparations.filter((p) => matchesPreparation(p, query)) : null;

  return (
    <div className="flex flex-col gap-4">
      <input
        type="search"
        enterKeyHint="search"
        placeholder={t("search")}
        aria-label={t("search")}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className={ui.input}
      />

      {found ? (
        <ul className={card.surface}>
          {found.map((p) => (
            <li key={p.id} className="border-b border-line last:border-b-0">
              <Link href={`/catalog/preparations/${p.id}`} className="flex min-h-11 flex-col gap-0.5 px-4 py-3">
                <span className="text-base font-semibold text-ink">
                  {p.favorite && <span aria-label={t("favoriteMark")}>⭐ </span>}
                  {p.name}
                </span>
                <span className="text-sm text-muted">{[p.manufacturer, p.typeName].filter(Boolean).join(" · ")}</span>
              </Link>
            </li>
          ))}
          {found.length === 0 && <li className={`${ui.muted} px-4 py-6 text-center`}>{t("noResults")}</li>}
        </ul>
      ) : (
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <h2 className={card.heading}>{t("types")}</h2>
            <Link
              href="/catalog/types/new"
              className={ui.addButton}
            >
              {t("newType")}
            </Link>
          </div>
          <ul className={card.surface}>
            {types.map((type) => (
              <li key={type.id} className="border-b border-line last:border-b-0">
                <Link href={`/catalog/types/${type.id}`} className="flex min-h-11 items-center gap-3 px-4 py-3">
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-base font-semibold text-ink">{type.name}</span>
                    <span className="text-sm text-muted">{t("preparationsCount", { count: type.preparationCount })}</span>
                  </span>
                  {type.missing && <span className={ui.alertTag}>{t("toFill")}</span>}
                  <span aria-hidden className="text-muted">
                    ›
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
