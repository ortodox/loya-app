import { notFound } from "next/navigation";
import { practiceTimeZone } from "@/config/time";
import { clinicalSections } from "@/config/kartaTemplate";
import { clientRepository } from "@/data/repositories/server";
import { normalizeField } from "@/logic/rules/anamnesis";
import { todayIn } from "@/logic/rules/dates";
import { getClientCard } from "@/logic/usecases/clients";
import { updateAnamnesisSectionAction } from "../../../../actions";
import { AnamnesisSectionForm } from "../../AnamnesisSectionForm";

/** AN3: edit one section of «Анкета» without the whole client form. */
export default async function EditAnamnesisSectionPage({ params }: { params: Promise<{ id: string; section: string }> }) {
  const { id, section } = await params;
  if (!clinicalSections.some((s) => s.key === section)) notFound();
  const card = await getClientCard(await clientRepository(), id, todayIn(practiceTimeZone));
  if (!card) notFound();
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-2 pb-8">
      <AnamnesisSectionForm
        cancelHref={`/clients/${id}#anketa`}
        section={section}
        values={Object.fromEntries(Object.entries(card.client.anamnesis).map(([key, value]) => [key, normalizeField(value)]))}
        action={updateAnamnesisSectionAction.bind(null, id, section)}
      />
    </main>
  );
}
