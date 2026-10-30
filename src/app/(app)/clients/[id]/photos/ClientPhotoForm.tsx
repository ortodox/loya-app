"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { card, ui } from "@/app/components/ui";
import type { IsoDate } from "@/logic/client";
import { exifDate, exifHeadBytes, maxClientPhotosPerSave, suggestedPhotoDate } from "@/logic/rules/client-photos";
import { PhotoField, type NewPhoto } from "../visits/PhotoField";
import type { ClientPhotoFormState } from "./actions";

type Props = {
  cancelHref: string;
  today: IsoDate;
  /** FK3: adding in «Лечение» – the course the photos belong to. */
  course: { diagnosis: string } | null;
  action: (state: ClientPhotoFormState, fd: FormData) => Promise<ClientPhotoFormState>;
};

/** FK1/FK2: 1–3 photos the client sent, with the date taken (from the photo when it is there). */
export function ClientPhotoForm({ cancelHref, today, course, action }: Props) {
  const t = useTranslations();
  const [state, formAction, pending] = useActionState(action, { takenOn: today });
  const [, startTransition] = useTransition();
  const [photos, setPhotos] = useState<NewPhoto[]>([]);
  const [takenOn, setTakenOn] = useState(state.takenOn);
  const [dateTouched, setDateTouched] = useState(false);
  const [found, setFound] = useState<(IsoDate | null)[]>([]);

  // FK2: the date taken is read before the photo is compressed (compressing drops it).
  async function readDates(files: File[]) {
    const dates = await Promise.all(files.map(async (f) => exifDate(new Uint8Array(await f.slice(0, exifHeadBytes).arrayBuffer()))));
    const all = [...found, ...dates];
    setFound(all);
    if (!dateTouched) setTakenOn(suggestedPhotoDate(all, today));
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    for (const p of photos) fd.append("photos", new File([p.blob], `${p.key}.jpg`, { type: "image/jpeg" }));
    startTransition(() => formAction(fd));
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <header className="flex items-center justify-between gap-4">
        <Link href={cancelHref} className={ui.textButton}>
          {t("form.cancel")}
        </Link>
        <h1 className="text-center font-serif text-2xl text-ink">
          {course ? t("clientPhotos.newTitleCourse") : t("clientPhotos.newTitle")}
        </h1>
        <button type="submit" disabled={pending || photos.length === 0} className={`${ui.textButton} font-semibold disabled:opacity-50`}>
          {t("form.save")}
        </button>
      </header>
      {course && <p className="text-center text-sm text-muted">{t("clientPhotos.forCourse", { diagnosis: course.diagnosis })}</p>}

      <section className={`${card.surface} flex flex-col gap-3 p-4`}>
        <h2 className={card.heading}>{t("clientPhotos.photos")}</h2>
        <PhotoField
          existing={[]}
          removed={[]}
          added={photos}
          max={maxClientPhotosPerSave}
          addLabel={t("clientPhotos.add")}
          hint={t("clientPhotos.photosHint")}
          onRemoveExisting={() => {}}
          onAdd={(added) => setPhotos((p) => [...p, ...added])}
          onRemoveNew={(key) => setPhotos(photos.filter((p) => p.key !== key))}
          onFiles={(files) => void readDates(files)}
        />
        {state.errors?.photos && <p className={ui.error}>{t(`clientPhotos.errors.${state.errors.photos}`)}</p>}
      </section>

      <label className={`${card.surface} flex flex-col gap-2 p-4`}>
        <span className={card.heading}>{t("clientPhotos.takenOn")}</span>
        <span className="text-sm text-muted">{t("clientPhotos.takenOnHint")}</span>
        <input
          name="takenOn"
          type="date"
          required
          max={today}
          value={takenOn}
          onChange={(e) => {
            setDateTouched(true);
            setTakenOn(e.target.value);
          }}
          className={ui.input}
        />
        {state.errors?.takenOn && <span className={ui.error}>{t(`clientPhotos.errors.${state.errors.takenOn}`)}</span>}
      </label>

      {state.failed && <p className={ui.error}>{t("form.saveFailed")}</p>}
      <button type="submit" disabled={pending || photos.length === 0} className={ui.button}>
        {t("form.save")}
      </button>
    </form>
  );
}
