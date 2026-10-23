import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { practiceTimeZone } from "@/config/time";
import { clientRepository } from "@/data/repositories/server";
import { todayIn } from "@/logic/rules/dates";
import { getClientCard } from "@/logic/usecases/clients";
import { createVisitAction } from "../actions";
import { VisitForm } from "../VisitForm";

export default async function NewVisitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const today = todayIn(practiceTimeZone);
  if (!(await getClientCard(await clientRepository(), id, today))) notFound();
  const t = await getTranslations("visits");

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-6">
      <VisitForm
        title={t("newTitle")}
        initial={{ visitDate: today }}
        cancelHref={`/clients/${id}`}
        action={createVisitAction.bind(null, id)}
      />
    </main>
  );
}
