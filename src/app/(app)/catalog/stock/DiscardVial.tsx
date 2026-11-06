"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { discardVialAction } from "./actions";

/** SK1 «Списать остаток»: an open vial is thrown away – asks first, in a panel at the bottom of the screen. */
export function DiscardVial({ itemId, vialKey, label }: { itemId: string; vialKey: string; label: string }) {
  const t = useTranslations("stock");
  const [confirming, setConfirming] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <button type="button" onClick={() => setConfirming(true)} className="inline-flex min-h-11 shrink-0 items-center text-sm text-on-alert">
        {t("discard")}
      </button>
      {confirming && (
        <div
          role="alertdialog"
          aria-label={t("discard")}
          className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-w-2xl flex-col gap-3 rounded-t-[18px] bg-alert p-4 pb-[calc(1rem+var(--safe-bottom))] text-on-alert shadow-lg"
        >
          <p className="text-base">{t("confirmDiscard", { vial: label })}</p>
          {failed && <p className="text-sm font-semibold">{t("failed")}</p>}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setConfirming(false)} className="min-h-11 rounded-[14px] border border-current px-3 text-sm">
              {t("cancel")}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const { ok } = await discardVialAction(itemId, vialKey);
                  if (ok) setConfirming(false);
                  else setFailed(true);
                })
              }
              className="min-h-11 rounded-[14px] bg-on-alert px-3 text-sm font-semibold text-alert disabled:opacity-50"
            >
              {t("discardYes")}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
