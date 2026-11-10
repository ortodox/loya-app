import { getTranslations } from "next-intl/server";
import { shopRepository } from "@/data/repositories/server";
import { getShop } from "@/logic/usecases/shop";
import { saveShopProductAction } from "../../actions";
import { ShopProductForm } from "../../ShopProductForm";

/** MG1 «+ Товар». */
export default async function NewShopProductPage() {
  const t = await getTranslations("shop");
  const { brands } = await getShop(await shopRepository());
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-2 pb-8">
      <ShopProductForm title={t("newTitle")} initial={{ currency: "PLN" }} brands={brands} action={saveShopProductAction.bind(null, null)} />
    </main>
  );
}
