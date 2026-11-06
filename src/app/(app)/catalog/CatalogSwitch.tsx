import { getTranslations } from "next-intl/server";
import Link from "next/link";

/** RS1: «Каталог | Расход» at the top of «Препараты» («Склад» joins with SK1). */
export async function CatalogSwitch({ current }: { current: "catalog" | "usage" }) {
  const t = await getTranslations("consumption");
  const item = (key: "catalog" | "usage", href: string) => (
    <Link
      href={href}
      aria-current={current === key ? "page" : undefined}
      className={`flex min-h-11 flex-1 items-center justify-center rounded-[14px] text-sm font-semibold ${
        current === key ? "bg-primary text-on-primary" : "text-ink"
      }`}
    >
      {t(key === "catalog" ? "viewCatalog" : "viewUsage")}
    </Link>
  );
  return (
    <nav aria-label={t("switchLabel")} className="flex gap-1 rounded-[18px] border border-field bg-surface p-1">
      {item("catalog", "/catalog")}
      {item("usage", "/catalog?view=usage")}
    </nav>
  );
}
