"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { activeTab, showTabBar, tabs, type TabKey } from "@/config/navigation";
import { ClientsIcon, PreparationsIcon } from "./Icons";

const icons: Record<TabKey, (p: { className?: string }) => React.ReactNode> = {
  clients: ClientsIcon,
  preparations: PreparationsIcon,
};

/**
 * iOS-style tab bar at the bottom of the main pages (not in forms). The spacer keeps the last
 * content above the bar; the home indicator area is added via --safe-bottom (globals.css).
 */
export function TabBar() {
  const t = useTranslations("tabs");
  const pathname = usePathname();
  if (!showTabBar(pathname)) return null;
  const current = activeTab(pathname);

  return (
    <>
      <div aria-hidden className="h-16 shrink-0" />
      <nav
        aria-label={t("label")}
        className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 pb-[var(--safe-bottom)] backdrop-blur"
      >
        <ul className="mx-auto grid h-16 max-w-2xl" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
          {tabs.map((tab) => {
            const Icon = icons[tab.key];
            const active = tab.key === current;
            return (
              <li key={tab.key}>
                <Link
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex h-full min-h-11 flex-col items-center justify-center gap-0.5 text-xs font-medium ${
                    active ? "text-accent" : "text-muted"
                  }`}
                >
                  <Icon />
                  {t(tab.key)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
