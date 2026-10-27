"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { card, ui } from "@/app/components/ui";
import { labUnits } from "@/logic/course";
import { maxCoursePhotosPerSave, type CourseForm as CourseFormValues } from "@/logic/rules/courses";
import { PhotoField, type ExistingPhoto, type NewPhoto } from "../visits/PhotoField";
import type { CourseFormState } from "./actions";

type Props = {
  title: string;
  cancelHref: string;
  initial: CourseFormValues;
  photos: ExistingPhoto[];
  action: (state: CourseFormState, fd: FormData) => Promise<CourseFormState>;
};

/** LE1/LE3/LE6 «Курс лечения»: diagnosis, prescription, dates, optional lab control, prescription photos. */
export function CourseForm({ title, cancelHref, initial, photos, action }: Props) {
  const t = useTranslations();
  const [state, formAction, pending] = useActionState(action, { values: initial });
  const [, startTransition] = useTransition();
  const v = state.values;
  const [lab, setLab] = useState(v.labEnabled === "1");
  const [lastLab, setLastLab] = useState(v.lastLabDate ?? "");
  const [removedPhotos, setRemovedPhotos] = useState<string[]>([]);
  const [newPhotos, setNewPhotos] = useState<NewPhoto[]>([]);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    for (const p of newPhotos) fd.append("photos", new File([p.blob], `${p.key}.jpg`, { type: "image/jpeg" }));
    for (const id of removedPhotos) fd.append("removePhotoIds", id);
    startTransition(() => formAction(fd));
  }

  const error = (key: "diagnosis" | "startDate" | "endDate" | "lab" | "lastLabDate" | "photos") =>
    state.errors?.[key] ? <p className={ui.error}>{t(`courses.errors.${state.errors[key]}`)}</p> : null;

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <header className="flex items-center justify-between gap-4">
        <Link href={cancelHref} className={ui.textButton}>
          {t("form.cancel")}
        </Link>
        <h1 className="text-center font-serif text-2xl text-ink">{title}</h1>
        <button type="submit" disabled={pending} className={`${ui.textButton} font-semibold disabled:opacity-50`}>
          {t("form.save")}
        </button>
      </header>

      <section className={`${card.surface} flex flex-col gap-4 p-4`}>
        <label className="flex flex-col gap-2">
          <span className={card.label}>
            {t("courses.diagnosis")} <span className="text-xs">({t("form.required")})</span>
          </span>
          <input name="diagnosis" required autoComplete="off" defaultValue={v.diagnosis} className={ui.input} />
          {error("diagnosis")}
        </label>
        <label className="flex flex-col gap-2">
          <span className={card.label}>{t("courses.prescription")}</span>
          <span className="text-sm text-muted">{t("courses.prescriptionHint")}</span>
          <textarea name="prescription" rows={5} defaultValue={v.prescription} className={ui.input} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-2">
            <span className={card.label}>{t("courses.startDate")}</span>
            <input name="startDate" type="date" required defaultValue={v.startDate} className={ui.input} />
            {error("startDate")}
          </label>
          <label className="flex flex-col gap-2">
            <span className={card.label}>{t("courses.endDate")}</span>
            <input name="endDate" type="date" required defaultValue={v.endDate} className={ui.input} />
          </label>
        </div>
        {error("endDate")}
      </section>

      {/* LE6: optional, e.g. every 2,5 months for isotretinoin. */}
      <section className={`${card.surface} flex flex-col gap-3 p-4`}>
        <label className="flex min-h-11 items-center gap-3">
          <input
            type="checkbox"
            name="labEnabled"
            value="1"
            checked={lab}
            onChange={(e) => setLab(e.target.checked)}
            className="size-5 shrink-0 accent-[var(--accent)]"
          />
          <span className={card.heading}>{t("courses.labControl")}</span>
        </label>
        {lab && (
          <>
            <div className="flex items-end gap-2">
              <label className="flex flex-1 flex-col gap-2">
                <span className={card.label}>{t("courses.labEvery")}</span>
                <input name="labValue" inputMode="decimal" defaultValue={v.labValue} placeholder="2,5" className={ui.input} />
              </label>
              <select name="labUnit" defaultValue={v.labUnit || "months"} aria-label={t("courses.labEvery")} className={`${ui.input} w-auto`}>
                {labUnits.map((u) => (
                  <option key={u} value={u}>
                    {t(`courses.units.${u}`)}
                  </option>
                ))}
              </select>
            </div>
            {error("lab")}
            <label className="flex flex-col gap-2">
              <span className={card.label}>{t("courses.lastLabDate")}</span>
              {/* LE6: can be cleared – the next tests are then counted from the start date. */}
              <span className="flex items-center gap-2">
                <input
                  name="lastLabDate"
                  type="date"
                  value={lastLab}
                  onChange={(e) => setLastLab(e.target.value)}
                  className={`${ui.input} flex-1`}
                />
                {lastLab && (
                  <button
                    type="button"
                    onClick={() => setLastLab("")}
                    className="inline-flex min-h-11 shrink-0 items-center px-2 text-sm font-medium text-on-alert"
                  >
                    {t("courses.clear")}
                  </button>
                )}
              </span>
              {error("lastLabDate")}
            </label>
          </>
        )}
      </section>

      {/* LE3: photos of the prescriptions, more at every renewal. */}
      <section className={`${card.surface} flex flex-col gap-3 p-4`}>
        <h2 className={card.heading}>{t("courses.photos")}</h2>
        <PhotoField
          existing={photos}
          removed={removedPhotos}
          added={newPhotos}
          max={photos.length - removedPhotos.length + maxCoursePhotosPerSave}
          addLabel={t("courses.addPhoto")}
          hint={t("courses.photosHint")}
          onRemoveExisting={(id) => setRemovedPhotos([...removedPhotos, id])}
          onAdd={(added) => setNewPhotos([...newPhotos, ...added])}
          onRemoveNew={(key) => setNewPhotos(newPhotos.filter((p) => p.key !== key))}
        />
        {error("photos")}
      </section>

      {state.failed && <p className={ui.error}>{t("form.saveFailed")}</p>}
      <button type="submit" disabled={pending} className={ui.button}>
        {t("form.save")}
      </button>
    </form>
  );
}
