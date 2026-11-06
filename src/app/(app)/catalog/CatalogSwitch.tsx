import { getTranslations } from "next-intl/server";
import Link from "next/link";

/** RS1/SK1: «Каталог | Склад | Расход» at the top of «Препараты». */
export async function CatalogSwitch({ current }: { current: "catalog" | "stock" | "usage" }) {
  const t = await getTranslations("consumption");
  const item = (key: "catalog" | "stock" | "usage", href: string) => (
    <Link
      href={href}
      aria-current={current === key ? "page" : undefined}
      className={`flex min-h-11 flex-1 items-center justify-center rounded-[14px] text-sm font-semibold ${
        current === key ? "bg-primary text-on-primary" : "text-ink"
      }`}
    >
      {t(key === "catalog" ? "viewCatalog" : key === "stock" ? "viewStock" : "viewUsage")}
    </Link>
  );
  return (
    <nav aria-label={t("switchLabel")} className="flex gap-1 rounded-[18px] border border-field bg-surface p-1">
      {item("catalog", "/catalog")}
      {item("stock", "/catalog?view=stock")}
      {item("usage", "/catalog?view=usage")}
    </nav>
  );
}
