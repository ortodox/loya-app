// Bottom tab bar (iOS style). Add a tab here – e.g. «Наблюдение» (MVP 3) – and it appears everywhere.
// Labels live in messages/*.json under tabs.<key>; icons in src/app/components/Icons.tsx.

export type TabKey = "today" | "clients" | "preparations" | "settings";

export type Tab = {
  key: TabKey;
  href: string;
  /** Path prefixes that belong to the tab (the tab is highlighted on them). */
  match: readonly string[];
  /** ⚙: only the icon is shown – the name is read out by screen readers. */
  iconOnly?: boolean;
};

// TD1/ST1 (05.11.2026): «Сегодня» first, then «Клиенты», «Препараты» and ⚙ (settings, icon only).
export const tabs: readonly Tab[] = [
  { key: "today", href: "/today", match: ["/today"] },
  { key: "clients", href: "/clients", match: ["/clients"] },
  { key: "preparations", href: "/catalog", match: ["/catalog"] },
  { key: "settings", href: "/settings", match: ["/settings"], iconOnly: true },
];

/** The tab a path belongs to, if any. */
export function activeTab(pathname: string): TabKey | null {
  const tab = tabs.find((t) => t.match.some((m) => pathname === m || pathname.startsWith(`${m}/`)));
  return tab?.key ?? null;
}

/** The tab bar is only shown on the main pages, never in forms (new / edit). */
export function showTabBar(pathname: string): boolean {
  if (activeTab(pathname) === null) return false;
  const segments = pathname.split("/").filter(Boolean);
  return !segments.some((s) => s === "new" || s === "edit");
}
