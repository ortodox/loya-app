"use client";

import { useState } from "react";

type Tab = { key: string; label: string; count: number; urgent: boolean; content: React.ReactNode };

/** TD2: «⏰ Пора · 📦 Выдача · 🛒 Закупка» – always opens on «⏰ Пора»; a number and a red dot when urgent. */
export function TodayTabs({ tabs, label }: { tabs: Tab[]; label: string }) {
  const [active, setActive] = useState(tabs[0]?.key);
  const current = tabs.find((t) => t.key === active) ?? tabs[0];
  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label={label} className="flex gap-1 rounded-[18px] border border-field bg-surface p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={t.key === current.key}
            onClick={() => setActive(t.key)}
            className={`relative flex min-h-11 min-w-0 flex-1 items-center justify-center gap-1 rounded-[14px] px-1 text-sm font-semibold ${t.key === current.key ? "bg-primary text-on-primary" : "text-ink"}`}
          >
            <span className="truncate">{t.label}</span>
            {t.count > 0 && <span className="tabular-nums">({t.count})</span>}
            {t.urgent && <span aria-hidden className="absolute top-1.5 right-2 size-2.5 rounded-full bg-on-alert" />}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="flex flex-col gap-5">
        {current.content}
      </div>
    </div>
  );
}
