import { getTranslations } from "next-intl/server";
import { practiceTimeZone } from "@/config/time";
import { todayIn } from "@/logic/rules/dates";
import { createClientAction } from "../actions";
import { ClientForm } from "../ClientForm";

export default async function NewClientPage() {
  const t = await getTranslations("form");
  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-6">
      <ClientForm
        title={t("titleNew")}
        initial={{ cardDate: todayIn(practiceTimeZone), language: "ru" }}
        cancelHref="/clients"
        action={createClientAction}
      />
    </main>
  );
}
