import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { visitRepository } from "@/data/repositories/server";
import { getVisit } from "@/logic/usecases/visits";
import { deleteVisitAction, updateVisitAction } from "../../actions";
import { VisitForm } from "../../VisitForm";

export default async function EditVisitPage({
  params,
}: {
  params: Promise<{ id: string; visitId: string }>;
}) {
  const { id, visitId } = await params;
  const visit = await getVisit(await visitRepository(), id, visitId);
  if (!visit) notFound();
  const t = await getTranslations("visits");

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-6">
      <VisitForm
        title={t("editTitle")}
        initial={{
          visitDate: visit.visitDate,
          homeCareRecommendations: visit.homeCareRecommendations ?? "",
          procedurePlan: visit.procedurePlan ?? "",
        }}
        cancelHref={`/clients/${id}`}
        action={updateVisitAction.bind(null, id, visitId)}
        onDelete={deleteVisitAction.bind(null, id, visitId)}
      />
    </main>
  );
}
