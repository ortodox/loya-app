import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { BrandMark } from "@/app/components/Brand";
import { LanguageSelect } from "@/app/components/LanguageSelect";
import { SignOutButton } from "@/app/components/SignOutButton";
import { card, ui } from "@/app/components/ui";
import type { IsoDate } from "@/logic/client";
import { archiveClientAction, archiveSavedAction, archiveStartAction } from "../clients/archive-actions";
import { ArchiveBlock, type ArchiveActions } from "../clients/ArchiveBlock";

/** ST1 ⚙ «Настройки»: «Резервная копия» (EX1), «Удалённые клиенты» (PR6), language and sign out. */
export async function SettingsView(props: {
  archive: { date: IsoDate; days: number; stale: boolean } | null;
  deletedCount: number;
  archiveActions?: ArchiveActions;
}) {
  const { archive, deletedCount } = props;
  const archiveActions = props.archiveActions ?? { start: archiveStartAction, client: archiveClientAction, saved: archiveSavedAction };
  const t = await getTranslations();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-5 pt-4 pb-6">
      <header className="flex items-center justify-between gap-4">
        <BrandMark />
      </header>
      <h1 className="font-serif text-5xl leading-tight text-ink">{t("settings.title")}</h1>

      <ArchiveBlock last={archive} actions={archiveActions} />

      {/* PR6: deleted clients can be restored for 30 days. */}
      <section className={`${card.surface} flex flex-col gap-1 px-4 py-2`}>
        {deletedCount > 0 ? (
          <Link href="/clients/deleted" className={`${ui.textButton} self-start`}>
            {t("trash.link", { count: deletedCount })}
          </Link>
        ) : (
          <p className={ui.muted}>{t("settings.noDeleted")}</p>
        )}
      </section>

      <section className={`${card.surface} flex items-center justify-between gap-4 p-4`}>
        <LanguageSelect />
        <SignOutButton />
      </section>
    </main>
  );
}
