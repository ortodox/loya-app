import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { card, ui } from "@/app/components/ui";
import type { IsoDate } from "@/logic/client";
import { formatIsoDate, todayIn } from "@/logic/rules/dates";
import { practiceTimeZone } from "@/config/time";
import { restoreClientAction } from "../trash-actions";

type Deleted = { id: string; fullName: string; deletedAt: string; purgeOn: IsoDate };

/** PR6: the trash – name, when it was deleted, when it goes for good, «Восстановить». */
export async function DeletedClientsView({ deleted, failed }: { deleted: Deleted[]; failed: boolean }) {
  const t = await getTranslations("trash");
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-5 pt-2 pb-6">
      <Link href="/clients" className={`${ui.textButton} self-start`}>
        {t("back")}
      </Link>
      <div className="flex flex-col gap-1">
        <h1 className="font-serif text-4xl leading-tight text-ink">{t("title")}</h1>
        <p className={ui.muted}>{t("hint")}</p>
      </div>
      {failed && <p className={ui.error}>{t("restoreFailed")}</p>}
      {deleted.length === 0 ? (
        <p className={ui.muted}>{t("empty")}</p>
      ) : (
        <ul className={card.surface}>
          {deleted.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 last:border-b-0">
              <div className="flex min-w-0 flex-col">
                <span className="truncate font-semibold text-ink">{c.fullName}</span>
                <span className="text-sm text-muted">{t("deletedOn", { date: formatIsoDate(todayIn(practiceTimeZone, new Date(c.deletedAt))) })}</span>
                <span className="text-sm text-on-alert">{t("purgeOn", { date: formatIsoDate(c.purgeOn) })}</span>
              </div>
              <form action={restoreClientAction.bind(null, c.id)}>
                <button type="submit" className={ui.addButton}>
                  {t("restore")}
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
