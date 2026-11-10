import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { shopRepository } from "@/data/repositories/server";
import { getShop } from "@/logic/usecases/shop";
import { saveShopProductAction } from "../../../actions";
import { ShopProductForm } from "../../../ShopProductForm";

/** MG1 «Изменить» – also the price, which Loya sets herself. */
export default async function EditShopProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const repo = await shopRepository();
  const product = /^[0-9a-f-]{36}$/i.test(id) ? await repo.getProduct(id) : null;
  if (!product) notFound();
  const t = await getTranslations("shop");
  const { brands } = await getShop(repo);
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-2 pb-8">
      <ShopProductForm
        title={t("editTitle")}
        initial={{
          name: product.name,
          brand: product.brand,
          category: product.category,
          size: product.size,
          price: String(product.price).replace(".", ","),
          currency: product.currency,
          favorite: product.favorite ? "on" : "",
          hidden: product.active ? "" : "on",
        }}
        brands={brands}
        action={saveShopProductAction.bind(null, product.id)}
      />
    </main>
  );
}
