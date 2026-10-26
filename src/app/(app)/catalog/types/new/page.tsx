import { getTranslations } from "next-intl/server";
import { catalogRepository } from "@/data/repositories/server";
import { getTypeFormData } from "@/logic/usecases/catalog";
import { saveTypeAction } from "../../actions";
import { TypeForm } from "../../TypeForm";

export default async function NewTypePage() {
  const t = await getTranslations("catalog");
  const { zones } = await getTypeFormData(await catalogRepository());
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-2 pb-8">
      <TypeForm
        title={t("newTypeTitle")}
        initial={{ name: {}, zoneIds: [] }}
        zones={zones}
        cancelHref="/catalog"
        action={saveTypeAction.bind(null, null)}
      />
    </main>
  );
}
