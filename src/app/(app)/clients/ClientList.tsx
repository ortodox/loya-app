"use client";

import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { ClientPicture } from "@/app/components/ClientPicture";
import { elapsedText } from "@/app/components/elapsed";
import { card, pill, ui } from "@/app/components/ui";
import { thumbUrl } from "@/logic/rules/thumbnails";
import { dueByType } from "@/logic/rules/reminders";
import { reminderTypeLabel, reminderTypesText } from "@/app/components/reminderType";
import type { Locale } from "@/config/locales";
import { directions, type Direction } from "@/logic/course";
import { matchesFilter, toggleFilter } from "@/logic/rules/courses";
import { matchesClient } from "@/logic/rules/client-list";
import { formatDayMonth, formatIsoDate } from "@/logic/rules/dates";
import type { ClientSummary } from "@/logic/usecases/clients";

export function ClientList({ clients, pictureUrls = {} }: { clients: ClientSummary[]; pictureUrls?: Record<string, string> }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Direction | null>(null);
  const shown = clients.filter((c) => matchesFilter(c, filter) && matchesClient(c, query));
  // N13 (part): who comes today and tomorrow, above the search.
  const agenda = (["today", "tomorrow"] as const)
    .map((day) => ({ day, clients: clients.filter((c) => c.agenda === day) }))
    .filter((g) => g.clients.length > 0);
  // N7 ✏️: «⏰ Ботокс · 2», «⏰ Биоревитализация · 1» – reminders that have come, by procedure type, until «Готово».
  const due = dueByType(clients);
  const rt = (key: "botox" | "procedure") => t(`reminders.${key}`);
  // BD1: birthdays today.
  const birthdays = clients.filter((c) => c.birthday);

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
      {(agenda.length > 0 || due.length > 0 || birthdays.length > 0) && (
        <section aria-label={t("clients.agendaLabel")} className={`${card.surface} flex flex-col gap-3 p-4`}>
          {birthdays.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <h2 className="text-sm font-semibold text-muted">
                {t("birthday.group")} · {birthdays.length}
              </h2>
              <div className="flex flex-wrap gap-2">
                {birthdays.map((c) => (
                  <Link key={c.id} href={`/clients/${c.id}`} className={`${pill.base} ${pill.off}`}>
                    {c.fullName}
                  </Link>
                ))}
              </div>
            </div>
          )}
          {due.map((g) => (
            <div key={g.type?.id ?? "none"} className="flex flex-col gap-1.5">
              <h2 className="text-sm font-semibold text-muted">
                {t("reminders.dueGroup", { type: reminderTypeLabel(rt, g.type, locale) })} · {g.clients.length}
              </h2>
              <div className="flex flex-wrap gap-2">
                {g.clients.map((c) => (
                  <Link key={c.id} href={`/clients/${c.id}`} className={`${pill.base} ${pill.off}`}>
                    {c.fullName}
                  </Link>
                ))}
              </div>
            </div>
          ))}
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
              {/* FK6: the main photo, or initials. */}
              <ClientPicture name={c.fullName} url={c.photoPath ? thumbUrl(pictureUrls, c.photoPath) : null} size="list" />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-base font-semibold text-ink">{c.fullName}</span>
                <span className="text-sm text-muted">
                  {formatIsoDate(c.date)}
                  {c.age !== null && ` · ${t("clients.age", { age: c.age })}`}
                </span>
                {/* BO1: how long the botox has been in, without opening the client. */}
                {c.botox && (
                  <span className="text-sm font-medium text-ink">
                    {t("clients.botox", { time: elapsedText((key, values) => t(`clients.${key}`, values), c.botox) })}
                  </span>
                )}
                {/* BD1: birthday today. */}
                {c.birthday && <span className="text-sm font-semibold text-ink">{t("birthday.row")}</span>}
                {/* N7: time for the next procedure. */}
                {c.dueReminders.length > 0 && (
                  <span className="text-sm font-semibold text-ink">{t("reminders.dueRow", { types: reminderTypesText(rt, c.dueReminders, locale) })}</span>
                )}
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
