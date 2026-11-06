import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { listAddablePreparations } from "@/logic/usecases/stock";
import { addToStockAction } from "../../actions";
import { stockDeps } from "../../deps";
import { AddStockForm } from "./AddStockForm";

/** SK1: one preparation onto «Склад» – botox with its vial sizes, the rest in pieces. */
export default async function AddPreparationToStockPage({ params }: { params: Promise<{ prepId: string }> }) {
  const { prepId } = await params;
  const preparation = (await listAddablePreparations(await stockDeps())).find((p) => p.id === prepId);
  if (!preparation) notFound();
  const t = await getTranslations("stock");
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-2 pb-8">
      <AddStockForm title={t("addTitle")} name={preparation.name} botox={preparation.botox} action={addToStockAction.bind(null, preparation.id)} />
    </main>
  );
}
