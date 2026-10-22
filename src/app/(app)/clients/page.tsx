import { getTranslations } from "next-intl/server";
import { LanguageSelect } from "@/app/components/LanguageSelect";
import { SignOutButton } from "@/app/components/SignOutButton";
import { ui } from "@/app/components/ui";

export default async function ClientsPage() {
  const t = await getTranslations("clients");
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-5 py-6">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <div className="flex items-center gap-4">
          <LanguageSelect />
          <SignOutButton />
        </div>
      </header>
      <p className={ui.muted}>{t("empty")}</p>
    </main>
  );
}
