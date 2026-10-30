"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { compressImage } from "@/app/components/compressImage";
import { ui } from "@/app/components/ui";
import { maxPhotosPerVisit } from "@/logic/rules/visits";

export type ExistingPhoto = { id: string; url: string | null };
export type NewPhoto = { key: string; blob: Blob; url: string };

type Props = {
  existing: ExistingPhoto[];
  removed: string[];
  added: NewPhoto[];
  onRemoveExisting: (id: string) => void;
  onAdd: (photos: NewPhoto[]) => void;
  onRemoveNew: (key: string) => void;
  /** How many photos fit (LOT1: 3 per visit; LE3: 3 per save). */
  max?: number;
  /** LE3: own button text and hint for prescription photos. */
  addLabel?: string;
  hint?: string;
  /** FK2: the original files before compression (compressing drops the date taken). */
  onFiles?: (files: File[]) => void;
};

/** LOT1/LE3: photos from the camera or library, compressed on the phone before upload. */
export function PhotoField(props: Props) {
  const { existing, removed, added, onRemoveExisting, onAdd, onRemoveNew } = props;
  const { max = maxPhotosPerVisit, addLabel, hint, onFiles } = props;
  const t = useTranslations("visits");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const kept = existing.filter((p) => !removed.includes(p.id));
  const free = max - kept.length - added.length;

  async function choose(files: FileList | null) {
    setError(null);
    const list = Array.from(files ?? []);
    if (list.length === 0) return;
    if (list.length > free) setError(t("errors.tooManyPhotos"));
    setBusy(true);
    onFiles?.(list.slice(0, free));
    try {
      const photos: NewPhoto[] = [];
      for (const file of list.slice(0, free)) {
        const blob = await compressImage(file);
        photos.push({ key: crypto.randomUUID(), blob, url: URL.createObjectURL(blob) });
      }
      onAdd(photos);
    } catch {
      setError(t("errors.photoInvalid"));
    } finally {
      setBusy(false);
    }
  }

  const thumb = (url: string | null, label: string, onRemove: () => void, key: string) => (
    <li key={key} className="relative">
      {/* eslint-disable-next-line @next/next/no-img-element -- signed storage URL / local blob */}
      {url ? <img src={url} alt="" className="size-24 rounded-[14px] object-cover" /> : <div className="size-24 rounded-[14px] bg-line" />}
      <button type="button" onClick={onRemove} className="mt-1 flex min-h-11 w-24 items-center justify-center text-sm text-on-alert">
        {label}
      </button>
    </li>
  );

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-wrap gap-3">
        {kept.map((p) => thumb(p.url, t("removePhoto"), () => onRemoveExisting(p.id), p.id))}
        {added.map((p) => thumb(p.url, t("removePhoto"), () => onRemoveNew(p.key), p.key))}
      </ul>
      {free > 0 && (
        <label className={`${ui.addButton} cursor-pointer self-start`}>
          {busy ? t("compressing") : (addLabel ?? t("addPhoto"))}
          <input
            type="file"
            accept="image/*"
            multiple
            disabled={busy}
            className="sr-only"
            onChange={(e) => {
              void choose(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
      )}
      <p className="text-sm text-muted">{hint ?? t("photosHint")}</p>
      {error && <p className={ui.error}>{error}</p>}
    </div>
  );
}
