import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { card, ui } from "@/app/components/ui";
import type { Care } from "@/logic/document";
import { formatIsoDate } from "@/logic/rules/dates";

/** UH1/UH2: «Уход» in the client card – the doctor's own text and photos. */
export async function CareSection({ clientId, care, photoUrls }: { clientId: string; care: Care; photoUrls: Record<string, string> }) {
  const t = await getTranslations("care");
  const empty = !care.text && care.photos.length === 0;
  return (
    <section id="care" className={`${card.surface} flex scroll-mt-4 flex-col gap-3 p-4`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col">
          <h2 className={card.heading}>{t("title")}</h2>
          {care.updatedAt && <span className="text-sm text-muted">{t("updated", { date: formatIsoDate(care.updatedAt) })}</span>}
        </div>
        <Link href={`/clients/${clientId}/care/edit`} className={empty ? ui.addButton : `${ui.textButton} text-sm`}>
          {empty ? t("add") : t("edit")}
        </Link>
      </div>
      {empty ? (
        <p className={ui.muted}>{t("empty")}</p>
      ) : (
        <>
          {care.text && <p className="text-base whitespace-pre-wrap text-ink">{care.text}</p>}
          {care.photos.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {care.photos.map((p) =>
                photoUrls[p.storagePath] ? (
                  <li key={p.id}>
                    {/* UH2: open in full size. */}
                    <a href={photoUrls[p.storagePath]} target="_blank" rel="noreferrer" aria-label={t("openPhoto")}>
                      {/* eslint-disable-next-line @next/next/no-img-element -- signed storage URL */}
                      <img src={photoUrls[p.storagePath]} alt="" className="size-24 rounded-[14px] object-cover" />
                    </a>
                  </li>
                ) : (
                  <li key={p.id} className="size-24 rounded-[14px] bg-line" />
                ),
              )}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
