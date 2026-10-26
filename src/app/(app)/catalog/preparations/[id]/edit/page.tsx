import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Locale } from "@/config/locales";
import { catalogRepository } from "@/data/repositories/server";
import { settingsToForm } from "@/logic/rules/catalog-form";
import { getPreparationDetail, listTypes } from "@/logic/usecases/catalog";
import { savePreparationAction } from "../../../actions";
import { PreparationForm } from "../../../PreparationForm";
import { preparationFormProps } from "../../formProps";

export default async function EditPreparationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const repo = await catalogRepository();
  const detail = await getPreparationDetail(repo, id);
  if (!detail) notFound();
  const t = await getTranslations("catalog");
  const { preparation, type } = detail;
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-2 pb-8">
      <PreparationForm
        title={t("editPreparationTitle")}
        initial={{
          ...settingsToForm(preparation),
          name: preparation.name,
          manufacturer: preparation.manufacturer ?? "",
          favorite: preparation.favorite ? "on" : "",
          procedureTypeId: preparation.procedureTypeId,
        }}
        {...preparationFormProps(t, (await getLocale()) as Locale, await listTypes(repo), type)}
        cancelHref={`/catalog/preparations/${id}`}
        action={savePreparationAction.bind(null, id)}
      />
    </main>
  );
}
