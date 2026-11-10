"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { activeTab, showTabBar, tabs, type TabKey } from "@/config/navigation";
import { ClientsIcon, PreparationsIcon, SettingsIcon, ShopIcon, TodayIcon } from "./Icons";

const icons: Record<TabKey, (p: { className?: string }) => React.ReactNode> = {
  today: TodayIcon,
  clients: ClientsIcon,
  preparations: PreparationsIcon,
  shop: ShopIcon,
  settings: SettingsIcon,
};

/**
 * iOS-style tab bar at the bottom of the main pages (not in forms). The spacer keeps the last
 * content above the bar; the home indicator area is added via --safe-bottom (globals.css).
 */
export function TabBar({ badges = {} }: { badges?: Partial<Record<TabKey, number>> }) {
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
            // TD1: «Сегодня ③» – how many clients wait today; nothing when 0.
            const badge = badges[tab.key] ?? 0;
            const label = badge > 0 ? t("withCount", { tab: t(tab.key), count: badge }) : t(tab.key);
            return (
              <li key={tab.key}>
                <Link
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  aria-label={label}
                  className={`flex h-full min-h-11 flex-col items-center justify-center gap-0.5 text-xs font-medium ${
                    active ? "text-accent" : "text-muted"
                  }`}
                >
                  <span className="relative">
                    <Icon />
                    {badge > 0 && (
                      <span
                        aria-hidden
                        className="absolute -top-1.5 -right-3 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[11px] leading-none font-semibold text-on-primary"
                      >
                        {badge > 99 ? "99+" : badge}
                      </span>
                    )}
                  </span>
                  {/* ⚙: icon only – the name is in aria-label. */}
                  {!tab.iconOnly && <span aria-hidden>{t(tab.key)}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
