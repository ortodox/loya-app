import { getTranslations } from "next-intl/server";
import Link from "next/link";

export type ShopView = "catalog" | "stock" | "sales";

/** MG1–MG3: «Каталог | Склад | Продажи» at the top of «Магазин» – the same switch as in «Препараты». */
export async function ShopSwitch({ current }: { current: ShopView }) {
  const t = await getTranslations("shop");
  const item = (key: ShopView) => (
    <Link
      href={`/shop?view=${key}`}
      aria-current={current === key ? "page" : undefined}
      className={`flex min-h-11 flex-1 items-center justify-center rounded-[14px] text-sm font-semibold ${current === key ? "bg-primary text-on-primary" : "text-ink"}`}
    >
      {t(`view.${key}`)}
    </Link>
  );
  return (
    <nav aria-label={t("switchLabel")} className="flex gap-1 rounded-[18px] border border-field bg-surface p-1">
      {item("catalog")}
      {item("stock")}
      {item("sales")}
    </nav>
  );
}
