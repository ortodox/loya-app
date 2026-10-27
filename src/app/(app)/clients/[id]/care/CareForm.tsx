"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { card, ui } from "@/app/components/ui";
import { maxCarePhotosPerSave } from "@/logic/rules/documents";
import { PhotoField, type ExistingPhoto, type NewPhoto } from "../visits/PhotoField";
import type { CareFormState } from "./actions";

type Props = {
  cancelHref: string;
  text: string;
  photos: ExistingPhoto[];
  action: (state: CareFormState, fd: FormData) => Promise<CareFormState>;
};

/** UH1/UH2 «Уход»: free text and photos of products or the scheme. */
export function CareForm({ cancelHref, text, photos, action }: Props) {
  const t = useTranslations();
  const [state, formAction, pending] = useActionState(action, { text });
  const [, startTransition] = useTransition();
  const [removedPhotos, setRemovedPhotos] = useState<string[]>([]);
  const [newPhotos, setNewPhotos] = useState<NewPhoto[]>([]);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    for (const p of newPhotos) fd.append("photos", new File([p.blob], `${p.key}.jpg`, { type: "image/jpeg" }));
    for (const id of removedPhotos) fd.append("removePhotoIds", id);
    startTransition(() => formAction(fd));
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <header className="flex items-center justify-between gap-4">
        <Link href={cancelHref} className={ui.textButton}>
          {t("form.cancel")}
        </Link>
        <h1 className="text-center font-serif text-2xl text-ink">{t("care.editTitle")}</h1>
        <button type="submit" disabled={pending} className={`${ui.textButton} font-semibold disabled:opacity-50`}>
          {t("form.save")}
        </button>
      </header>

      <label className={`${card.surface} flex flex-col gap-2 p-4`}>
        <span className={card.heading}>{t("care.textLabel")}</span>
        <span className="text-sm text-muted">{t("care.textHint")}</span>
        <textarea name="text" rows={10} defaultValue={state.text} className={ui.input} />
      </label>

      <section className={`${card.surface} flex flex-col gap-3 p-4`}>
        <h2 className={card.heading}>{t("care.photos")}</h2>
        <PhotoField
          existing={photos}
          removed={removedPhotos}
          added={newPhotos}
          max={photos.length - removedPhotos.length + maxCarePhotosPerSave}
          addLabel={t("care.addPhoto")}
          hint={t("care.photosHint")}
          onRemoveExisting={(id) => setRemovedPhotos([...removedPhotos, id])}
          onAdd={(added) => setNewPhotos([...newPhotos, ...added])}
          onRemoveNew={(key) => setNewPhotos(newPhotos.filter((p) => p.key !== key))}
        />
        {state.errors?.photos && <p className={ui.error}>{t(`care.errors.${state.errors.photos}`)}</p>}
      </section>

      {state.failed && <p className={ui.error}>{t("form.saveFailed")}</p>}
      <button type="submit" disabled={pending} className={ui.button}>
        {t("form.save")}
      </button>
    </form>
  );
}
