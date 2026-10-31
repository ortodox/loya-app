import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { BrandMark } from "@/app/components/Brand";
import { LanguageSelect } from "@/app/components/LanguageSelect";
import { SignOutButton } from "@/app/components/SignOutButton";
import { ui } from "@/app/components/ui";
import type { ClientSummary } from "@/logic/usecases/clients";
import { ClientList } from "./ClientList";

export async function ClientsView(props: { clients: ClientSummary[]; deletedCount?: number; pictureUrls?: Record<string, string> }) {
  const { clients, deletedCount = 0, pictureUrls = {} } = props;
  const t = await getTranslations("clients");
  const tt = await getTranslations("trash");

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-5 pt-4 pb-6">
      <header className="flex items-center justify-between gap-4">
        <BrandMark />
        <Link href="/clients/new" className={ui.addButton}>
          {t("newButton")}
        </Link>
      </header>
      <div>
        <h1 className="font-serif text-5xl leading-tight text-ink">{t("title")}</h1>
        <p className={ui.muted}>{t("count", { count: clients.length })}</p>
      </div>
      <ClientList clients={clients} pictureUrls={pictureUrls} />
      {/* PR6: deleted clients can be restored for 30 days. */}
      {deletedCount > 0 && (
        <Link href="/clients/deleted" className={`${ui.textButton} self-start text-sm`}>
          {tt("link", { count: deletedCount })}
        </Link>
      )}
      <footer className="flex items-center justify-between gap-4">
        <LanguageSelect />
        <SignOutButton />
      </footer>
    </main>
  );
}
