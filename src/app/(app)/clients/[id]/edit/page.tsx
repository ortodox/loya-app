import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { practiceTimeZone } from "@/config/time";
import { clientRepository } from "@/data/repositories";
import { todayIn } from "@/logic/rules/dates";
import { getClientCard } from "@/logic/usecases/clients";
import { updateClientAction } from "../../actions";
import { ClientForm } from "../../ClientForm";

export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations("form");
  const card = await getClientCard(await clientRepository(), id, todayIn(practiceTimeZone));
  if (!card) notFound();
  const { client } = card;

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-6">
      <ClientForm
        title={t("titleEdit")}
        initial={{
          fullName: client.fullName,
          cardDate: client.cardDate,
          age: client.ageAtRegistration?.toString() ?? "",
          birthDate: client.birthDate ?? "",
          phone: client.phone ?? "",
          language: client.language ?? "ru",
          notes: client.notes ?? "",
        }}
        cancelHref={`/clients/${id}`}
        action={updateClientAction.bind(null, id)}
      />
    </main>
  );
}
