import { getTranslations } from "next-intl/server";
import { thumbUrl } from "@/logic/rules/thumbnails";
import type { ClientPhoto } from "@/logic/client-photo";
import { photoTimeline } from "@/logic/rules/client-photos";
import { formatIsoDate } from "@/logic/rules/dates";
import { DeleteClientPhoto } from "./DeleteClientPhoto";
import { MainPhotoToggle } from "./MainPhotoToggle";

/**
 * FK2/FK4: the client's photos by date taken, newest first – open in full size, delete with confirmation.
 * FK6: in «Фото клиента» (not in a course) each photo can be made the main photo.
 */
export async function ClientPhotoTimeline(props: { clientId: string; photos: ClientPhoto[]; urls: Record<string, string>; mainPhotoId?: string | null; canChooseMain?: boolean }) {
  const { clientId, photos, urls, mainPhotoId = null, canChooseMain = false } = props;
  const t = await getTranslations("clientPhotos");
  return (
    <ol className="flex flex-col gap-3">
      {photoTimeline(photos).map((group) => (
        <li key={group.date} className="flex flex-col gap-1.5">
          <h4 className="text-sm font-semibold text-muted">{formatIsoDate(group.date)}</h4>
          <ul className="flex flex-wrap gap-x-3">
            {group.photos.map((p) => (
              <li key={p.id} className="relative flex flex-col items-center">
                {canChooseMain && p.id === mainPhotoId && (
                  <span className="absolute top-1 left-1 z-10 rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-on-primary">{t("mainBadge")}</span>
                )}
                {urls[p.storagePath] ? (
                  <a href={urls[p.storagePath]} target="_blank" rel="noreferrer" aria-label={`${t("open")} ${formatIsoDate(p.takenOn)}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- signed storage URL */}
                    <img src={thumbUrl(urls, p.storagePath) ?? undefined} alt="" className="size-24 rounded-[14px] object-cover" />
                  </a>
                ) : (
                  <div className="size-24 rounded-[14px] bg-line" />
                )}
                {canChooseMain && <MainPhotoToggle clientId={clientId} photoId={p.id} isMain={p.id === mainPhotoId} />}
                <DeleteClientPhoto clientId={clientId} photoId={p.id} thumbUrl={thumbUrl(urls, p.storagePath)} />
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}
