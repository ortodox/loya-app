"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { setMainClientPhotoAction } from "./photos/actions";

/** FK6: «★ Сделать главным» / «Убрать из главного» – no question asked, one tap undoes it. */
export function MainPhotoToggle({ clientId, photoId, isMain }: { clientId: string; photoId: string; isMain: boolean }) {
  const t = useTranslations("clientPhotos");
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      aria-pressed={isMain}
      onClick={() =>
        startTransition(async () => {
          const { ok } = await setMainClientPhotoAction(clientId, isMain ? null : photoId);
          setFailed(!ok);
        })
      }
      className="flex min-h-11 w-24 items-center justify-center text-center text-xs leading-tight text-accent disabled:opacity-50"
    >
      {failed ? t("mainFailed") : isMain ? t("unsetMain") : t("setMain")}
    </button>
  );
}
