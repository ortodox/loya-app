// Bottom tab bar (iOS style). Add a tab here – e.g. «Наблюдение» (MVP 3) – and it appears everywhere.
// Labels live in messages/*.json under tabs.<key>; icons in src/app/components/Icons.tsx.

export type TabKey = "clients" | "preparations";

export type Tab = {
  key: TabKey;
  href: string;
  /** Path prefixes that belong to the tab (the tab is highlighted on them). */
  match: readonly string[];
};

export const tabs: readonly Tab[] = [
  { key: "clients", href: "/clients", match: ["/clients"] },
  { key: "preparations", href: "/catalog", match: ["/catalog"] },
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
