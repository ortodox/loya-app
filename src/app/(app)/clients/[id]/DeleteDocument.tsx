"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { deleteDocumentAction } from "./documents/actions";

/** DK5: delete a file – asks first. */
export function DeleteDocument({ clientId, documentId }: { clientId: string; documentId: string }) {
  const t = useTranslations("documents");
  const [confirming, setConfirming] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className="inline-flex min-h-11 items-center text-sm text-on-alert">
        {t("delete")}
      </button>
    );
  }
  return (
    <div role="alertdialog" aria-label={t("delete")} className="flex w-full flex-col gap-2 rounded-[14px] bg-alert p-3 text-on-alert">
      <p className="text-sm">{t("confirmDelete")}</p>
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
              const { ok } = await deleteDocumentAction(clientId, documentId);
              if (!ok) setFailed(true);
            })
          }
          className="min-h-11 rounded-[14px] bg-on-alert px-3 text-sm font-semibold text-alert disabled:opacity-50"
        >
          {t("confirmYes")}
        </button>
      </div>
    </div>
  );
}
