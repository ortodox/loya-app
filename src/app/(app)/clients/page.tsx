import { getLocale, getTranslations } from "next-intl/server";
import { LanguageSelect } from "@/app/components/LanguageSelect";
import { SignOutButton } from "@/app/components/SignOutButton";
import { practiceTimeZone } from "@/config/time";
import { clientRepository } from "@/data/repositories/server";
import { countryName } from "@/logic/rules/country";
import { todayIn } from "@/logic/rules/dates";
import { listClients } from "@/logic/usecases/clients";
import { ClientList } from "./ClientList";

export default async function ClientsPage() {
  const t = await getTranslations("clients");
  const clients = await listClients(await clientRepository(), todayIn(practiceTimeZone));
  const locale = await getLocale();
  const countryNames = Object.fromEntries(
    clients.flatMap((c) => (c.residenceCountry ? [[c.residenceCountry, countryName(c.residenceCountry, locale)]] : [])),
  );

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-5 py-6">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <div className="flex items-center gap-4">
          <LanguageSelect />
          <SignOutButton />
        </div>
      </header>
      <ClientList clients={clients} countryNames={countryNames} />
    </main>
  );
}
