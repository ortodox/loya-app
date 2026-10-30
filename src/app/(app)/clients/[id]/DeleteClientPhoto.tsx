"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { deleteClientPhotoAction } from "./photos/actions";

/** FK4: delete a photo (e.g. added to the wrong client) – asks first, in a panel at the bottom of the screen. */
export function DeleteClientPhoto({ clientId, photoId, thumbUrl }: { clientId: string; photoId: string; thumbUrl: string | null }) {
  const t = useTranslations("clientPhotos");
  const [confirming, setConfirming] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <button type="button" onClick={() => setConfirming(true)} className="flex min-h-11 w-24 items-center justify-center text-sm text-on-alert">
        {t("delete")}
      </button>
      {confirming && (
        <div
          role="alertdialog"
          aria-label={t("delete")}
          className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-w-2xl flex-col gap-3 rounded-t-[18px] bg-alert p-4 pb-[calc(1rem+var(--safe-bottom))] text-on-alert shadow-lg"
        >
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- signed storage URL */}
            {thumbUrl && <img src={thumbUrl} alt="" className="size-16 shrink-0 rounded-[14px] object-cover" />}
            <p className="text-base">{t("confirmDelete")}</p>
          </div>
          {failed && <p className="text-sm font-semibold">{t("deleteFailed")}</p>}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setConfirming(false)} className="min-h-11 rounded-[14px] border border-current px-3 text-sm">
              {t("confirmNo")}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const { ok } = await deleteClientPhotoAction(clientId, photoId);
                  if (ok) setConfirming(false);
                  else setFailed(true);
                })
              }
              className="min-h-11 rounded-[14px] bg-on-alert px-3 text-sm font-semibold text-alert disabled:opacity-50"
            >
              {t("confirmYes")}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
