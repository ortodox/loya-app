import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { practiceTimeZone } from "@/config/time";
import { clientRepository } from "@/data/repositories/server";
import { normalizeField } from "@/logic/rules/anamnesis";
import { countryOptions } from "@/logic/rules/country";
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
          email: client.email ?? "",
          residenceCountry: client.residenceCountry ?? "",
          residenceCity: client.residenceCity ?? "",
          anamnesis: Object.fromEntries(
            Object.entries(client.anamnesis).map(([key, value]) => [key, normalizeField(value)]),
          ),
          language: client.language ?? "ru",
          notes: client.notes ?? "",
          procedurePlan: client.procedurePlan ?? "",
          direction: client.direction,
        }}
        countries={countryOptions(await getLocale())}
        cancelHref={`/clients/${id}`}
        action={updateClientAction.bind(null, id)}
        openFilled
      />
    </main>
  );
}
