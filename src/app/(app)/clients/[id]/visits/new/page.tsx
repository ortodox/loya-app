import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Locale } from "@/config/locales";
import { practiceTimeZone } from "@/config/time";
import { todayIn } from "@/logic/rules/dates";
import { getVisitFormData } from "@/logic/usecases/visits";
import { saveVisitAction } from "../actions";
import { visitDeps } from "../deps";
import { visitFormProps } from "../formProps";
import { VisitForm } from "../VisitForm";

export default async function NewVisitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getVisitFormData(await visitDeps(), id, null);
  if (!data) notFound();
  const t = await getTranslations("visits");
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-2 pb-8">
      <VisitForm
        title={t("newTitle")}
        cancelHref={`/clients/${id}`}
        {...visitFormProps(data, (await getLocale()) as Locale, todayIn(practiceTimeZone))}
        draftKey={`visit:${id}`}
        action={saveVisitAction.bind(null, id, null)}
      />
    </main>
  );
}
