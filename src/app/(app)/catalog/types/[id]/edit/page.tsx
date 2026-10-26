import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { catalogRepository } from "@/data/repositories/server";
import { settingsToForm } from "@/logic/rules/catalog-form";
import { getTypeDetail } from "@/logic/usecases/catalog";
import { saveTypeAction } from "../../../actions";
import { TypeForm } from "../../../TypeForm";

export default async function EditTypePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getTypeDetail(await catalogRepository(), id);
  if (!detail) notFound();
  const t = await getTranslations("catalog");
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-2 pb-8">
      <TypeForm
        title={t("editTypeTitle")}
        initial={{ ...settingsToForm(detail.type), name: detail.type.name, zoneIds: detail.type.zoneIds }}
        zones={detail.zones}
        cancelHref={`/catalog/types/${id}`}
        action={saveTypeAction.bind(null, id)}
      />
    </main>
  );
}
