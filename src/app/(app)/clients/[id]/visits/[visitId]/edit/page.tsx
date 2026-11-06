import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Locale } from "@/config/locales";
import { practiceTimeZone } from "@/config/time";
import { todayIn } from "@/logic/rules/dates";
import { getVisitFormData } from "@/logic/usecases/visits";
import { getVisitStock } from "@/logic/usecases/stock";
import { consumptionRepository, stockRepository } from "@/data/repositories/server";
import { deleteVisitAction, saveVisitAction } from "../../actions";
import { visitDeps } from "../../deps";
import { visitFormProps } from "../../formProps";
import { VisitForm } from "../../VisitForm";

export default async function EditVisitPage({ params }: { params: Promise<{ id: string; visitId: string }> }) {
  const { id, visitId } = await params;
  const data = await getVisitFormData(await visitDeps(), id, visitId);
  if (!data) notFound();
  // SK1: «В наличии» under «Количество».
  const stock = await getVisitStock({ stock: await stockRepository(), visits: await consumptionRepository() }, todayIn(practiceTimeZone), visitId);
  const t = await getTranslations("visits");
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-2 pb-8">
      <VisitForm
        title={t("editTitle")}
        cancelHref={`/clients/${id}`}
        {...visitFormProps(data, (await getLocale()) as Locale, todayIn(practiceTimeZone))}
        stock={stock}
        action={saveVisitAction.bind(null, id, visitId)}
        onDelete={deleteVisitAction.bind(null, id, visitId)}
      />
    </main>
  );
}
