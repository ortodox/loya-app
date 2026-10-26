"use client";

import { useState } from "react";
import { locales, type Locale } from "@/config/locales";

/** RU / UK / PL / EN tabs (S2). `flagged` languages get a dot (needs review). */
export function LanguageTabs({
  initial,
  flagged,
  children,
}: {
  initial: Locale;
  flagged: Locale[];
  children: (locale: Locale) => React.ReactNode;
}) {
  const [active, setActive] = useState<Locale>(initial);
  return (
    <div className="flex flex-col gap-3">
      <div role="tablist" className="grid grid-cols-4 rounded-[14px] border border-field p-1">
        {locales.map((l) => (
          <button
            key={l}
            type="button"
            role="tab"
            aria-selected={active === l}
            onClick={() => setActive(l)}
            className="relative min-h-11 rounded-[10px] text-sm font-semibold tracking-wide text-ink aria-selected:bg-primary aria-selected:text-on-primary"
          >
            {l.toUpperCase()}
            {flagged.includes(l) && (
              <span aria-hidden className="absolute top-2 right-2 size-1.5 rounded-full bg-on-alert" />
            )}
          </button>
        ))}
      </div>
      {/* Every panel stays in the DOM so all languages are submitted with the form. */}
      {locales.map((l) => (
        <div key={l} role="tabpanel" hidden={active !== l}>
          {children(l)}
        </div>
      ))}
    </div>
  );
}
