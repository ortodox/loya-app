import { getTranslations } from "next-intl/server";
import type { ClientPhoto } from "@/logic/client-photo";
import { photoTimeline } from "@/logic/rules/client-photos";
import { formatIsoDate } from "@/logic/rules/dates";
import { DeleteClientPhoto } from "./DeleteClientPhoto";

/** FK2/FK4: the client's photos by date taken, newest first – open in full size, delete with confirmation. */
export async function ClientPhotoTimeline({ clientId, photos, urls }: { clientId: string; photos: ClientPhoto[]; urls: Record<string, string> }) {
  const t = await getTranslations("clientPhotos");
  return (
    <ol className="flex flex-col gap-3">
      {photoTimeline(photos).map((group) => (
        <li key={group.date} className="flex flex-col gap-1.5">
          <h4 className="text-sm font-semibold text-muted">{formatIsoDate(group.date)}</h4>
          <ul className="flex flex-wrap gap-x-3">
            {group.photos.map((p) => (
              <li key={p.id} className="flex flex-col items-center">
                {urls[p.storagePath] ? (
                  <a href={urls[p.storagePath]} target="_blank" rel="noreferrer" aria-label={`${t("open")} ${formatIsoDate(p.takenOn)}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- signed storage URL */}
                    <img src={urls[p.storagePath]} alt="" className="size-24 rounded-[14px] object-cover" />
                  </a>
                ) : (
                  <div className="size-24 rounded-[14px] bg-line" />
                )}
                <DeleteClientPhoto clientId={clientId} photoId={p.id} thumbUrl={urls[p.storagePath] ?? null} />
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}
