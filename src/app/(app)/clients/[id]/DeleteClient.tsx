"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { deleteClientAction } from "../trash-actions";

type Props = { clientId: string; name: string; plannedVisits: number; activeCourse: boolean };

/** PR6: red «Удалить клиента» at the bottom of the card – asks first, with extra warnings. */
export function DeleteClient({ clientId, name, plannedVisits, activeCourse }: Props) {
  const t = useTranslations("trash");
  const [confirming, setConfirming] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="flex min-h-11 w-full items-center justify-center rounded-[14px] bg-alert px-4 py-3 text-base font-semibold text-on-alert"
      >
        {t("delete")}
      </button>
      {confirming && (
        <div
          role="alertdialog"
          aria-label={t("delete")}
          className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-w-2xl flex-col gap-3 rounded-t-[18px] bg-alert p-4 pb-[calc(1rem+var(--safe-bottom))] text-on-alert shadow-lg"
        >
          <p className="text-base">{t("confirm", { name })}</p>
          {/* PR6: planned visits and an active course get their own warning. */}
          {(plannedVisits > 0 || activeCourse) && (
            <ul className="flex flex-col gap-1 text-base font-semibold">
              {plannedVisits > 0 && <li>⚠ {t("warnPlanned", { count: plannedVisits })}</li>}
              {activeCourse && <li>⚠ {t("warnCourse")}</li>}
            </ul>
          )}
          {failed && <p className="text-sm font-semibold">{t("failed")}</p>}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setConfirming(false)} className="min-h-11 rounded-[14px] border border-current px-3 text-sm">
              {t("confirmNo")}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await deleteClientAction(clientId);
                  if (!result.ok) setFailed(true);
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
