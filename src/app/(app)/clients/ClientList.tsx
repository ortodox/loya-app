"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { card, pill, ui } from "@/app/components/ui";
import { directions, type Direction } from "@/logic/course";
import { matchesFilter, toggleFilter } from "@/logic/rules/courses";
import { matchesClient } from "@/logic/rules/client-list";
import { formatDayMonth, formatIsoDate } from "@/logic/rules/dates";
import type { ClientSummary } from "@/logic/usecases/clients";

export function ClientList({ clients }: { clients: ClientSummary[] }) {
  const t = useTranslations();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Direction | null>(null);
  const shown = clients.filter((c) => matchesFilter(c, filter) && matchesClient(c, query));
  // N13 (part): who comes today and tomorrow, above the search.
  const agenda = (["today", "tomorrow"] as const)
    .map((day) => ({ day, clients: clients.filter((c) => c.agenda === day) }))
    .filter((g) => g.clients.length > 0);

  if (clients.length === 0) {
    return (
      <div className={`${card.surface} flex flex-col items-center gap-4 px-5 py-12 text-center`}>
        <p className={ui.muted}>{t("clients.empty")}</p>
        <Link href="/clients/new" className={`${ui.button} max-w-xs`}>
          {t("clients.emptyCta")}
        </Link>
      </div>
    );
  }

  return (
    <>
      {agenda.length > 0 && (
        <section aria-label={t("clients.agendaLabel")} className={`${card.surface} flex flex-col gap-2 p-4`}>
          {agenda.map((g) => (
            <div key={g.day} className="flex flex-col gap-1.5">
              <h2 className="text-sm font-semibold text-muted">
                {t(`clients.${g.day}`)} · {g.clients.length}
              </h2>
              <div className="flex flex-wrap gap-2">
                {g.clients.map((c) => (
                  <Link key={c.id} href={`/clients/${c.id}`} className={`${pill.base} ${g.day === "today" ? pill.on : pill.off}`}>
                    {c.fullName}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}
      <input
        type="search"
        enterKeyHint="search"
        placeholder={t("clients.search")}
        aria-label={t("clients.search")}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className={ui.input}
      />
      {/* DM1: «Косметология» / «Дерматология»; tap again to show everyone. */}
      <div role="group" aria-label={t("clients.filterLabel")} className="flex flex-wrap gap-2">
        {directions.map((d) => (
          <button
            key={d}
            type="button"
            aria-pressed={filter === d}
            onClick={() => setFilter(toggleFilter(filter, d))}
            className={`${pill.base} ${filter === d ? pill.on : pill.off}`}
          >
            {filter === d && <span aria-hidden>✓</span>}
            {t(`clients.filter.${d}`)}
          </button>
        ))}
      </div>
      <ul className={`${card.surface} flex flex-col`}>
        {shown.map((c) => (
          <li key={c.id} className="border-b border-line last:border-b-0">
            <Link href={`/clients/${c.id}`} className="flex min-h-11 items-start gap-3 px-4 py-3">
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-base font-semibold text-ink">{c.fullName}</span>
                <span className="text-sm text-muted">
                  {formatIsoDate(c.date)}
                  {c.age !== null && ` · ${t("clients.age", { age: c.age })}`}
                </span>
                {/* VP2: the next appointment. */}
                {c.nextVisitDate && (
                  <span className="text-sm font-medium text-accent">{t("clients.nextVisit", { date: formatDayMonth(c.nextVisitDate) })}</span>
                )}
                {/* LE4: active treatment course. */}
                {c.treatment && (
                  <span className={`text-sm font-medium ${c.treatment.ended ? "text-on-alert" : "text-ink"}`}>
                    {c.treatment.ended ? t("clients.treatmentEnded") : t("clients.onTreatment", { count: c.treatment.daysLeft })}
                  </span>
                )}
                {c.excerpt && <span className="truncate text-sm text-muted">{c.excerpt}</span>}
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1 pt-0.5">
                {/* PR5: country code; AL2: allergy tag. */}
                {c.residenceCountry && <span className={ui.tag}>{c.residenceCountry}</span>}
                {/* DM1: ✨ cosmetology, 🩺 dermatology. */}
                {c.direction.length > 0 && (
                  <span className="flex gap-1 text-base leading-none">
                    {c.direction.map((d) => (
                      <span key={d} role="img" aria-label={t(`direction.${d}`)}>
                        {d === "cosmetology" ? "✨" : "🩺"}
                      </span>
                    ))}
                  </span>
                )}
                {c.allergy && <span className={ui.alertTag}>{t("clients.allergyTag")}</span>}
              </span>
            </Link>
          </li>
        ))}
        {shown.length === 0 && <li className={`${ui.muted} px-4 py-6 text-center`}>{t("clients.noResults")}</li>}
      </ul>

    </>
  );
}
