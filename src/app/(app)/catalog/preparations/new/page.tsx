import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Locale } from "@/config/locales";
import { catalogRepository } from "@/data/repositories/server";
import { getNewPreparationData } from "@/logic/usecases/catalog";
import { savePreparationAction } from "../../actions";
import { PreparationForm } from "../../PreparationForm";
import { preparationFormProps } from "../formProps";

export default async function NewPreparationPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { type: typeId } = await searchParams;
  const data = await getNewPreparationData(await catalogRepository(), typeId);
  if (!data) notFound();
  const t = await getTranslations("catalog");
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-2 pb-8">
      <PreparationForm
        title={t("newPreparationTitle")}
        initial={{ procedureTypeId: data.type.id }}
        {...preparationFormProps(t, (await getLocale()) as Locale, data.types, data.type)}
        cancelHref={`/catalog/types/${data.type.id}`}
        action={savePreparationAction.bind(null, null)}
      />
    </main>
  );
}
