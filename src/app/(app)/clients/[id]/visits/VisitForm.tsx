"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { card, ui } from "@/app/components/ui";
import type { VisitForm as VisitFormValues } from "@/logic/rules/visits";
import type { VisitFormState } from "./actions";

type Props = {
  title: string;
  initial: VisitFormValues;
  cancelHref: string;
  action: (state: VisitFormState, formData: FormData) => Promise<VisitFormState>;
  /** Shown when editing: deletes the visit after an explicit confirmation. */
  onDelete?: () => Promise<{ failed: true }>;
};

export function VisitForm({ title, initial, cancelHref, action, onDelete }: Props) {
  const t = useTranslations();
  const [state, formAction, pending] = useActionState(action, {
    values: initial,
  });
  const v = state.values;

  return (
    <div className="flex flex-col gap-8">
      <form action={formAction} className="flex flex-col gap-4">
        <header className="flex items-center justify-between gap-4">
          <Link href={cancelHref} className={ui.textButton}>
            {t("form.cancel")}
          </Link>
          <h1 className="font-serif text-2xl text-ink">{title}</h1>
          <button
            type="submit"
            disabled={pending}
            className={`${ui.textButton} font-semibold disabled:opacity-50`}
          >
            {t("form.save")}
          </button>
        </header>

        <div className={`${card.surface} flex flex-col gap-5 p-4`}>
          <label className="flex flex-col gap-2">
            <span className={card.label}>{t("visits.date")}</span>
            <input name="visitDate" type="date" required defaultValue={v.visitDate} className={ui.input} />
            {state.errors?.visitDate && <p className={ui.error}>{t("visits.dateInvalid")}</p>}
          </label>

          <label className="flex flex-col gap-2">
            <span className={card.label}>{t("visits.homeCareRecommendations")}</span>
            <textarea
              name="homeCareRecommendations"
              rows={6}
              defaultValue={v.homeCareRecommendations}
              className={ui.input}
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className={card.label}>{t("visits.procedurePlan")}</span>
            <textarea name="procedurePlan" rows={6} defaultValue={v.procedurePlan} className={ui.input} />
          </label>
        </div>

        {state.failed && <p className={ui.error}>{t("form.saveFailed")}</p>}
        <button type="submit" disabled={pending} className={ui.button}>
          {t("form.save")}
        </button>
      </form>

      {onDelete && <DeleteVisit onDelete={onDelete} />}
    </div>
  );
}

function DeleteVisit({ onDelete }: { onDelete: () => Promise<{ failed: true }> }) {
  const t = useTranslations("visits");
  const [confirming, setConfirming] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="inline-flex min-h-11 items-center justify-center text-base font-medium text-on-alert"
      >
        {t("delete")}
      </button>
    );
  }

  return (
    <div
      role="alertdialog"
      aria-label={t("delete")}
      className="flex flex-col gap-3 rounded-[18px] bg-alert p-4 text-on-alert"
    >
      <p>{t("confirmDelete")}</p>
      {failed && <p className="text-sm">{t("deleteFailed")}</p>}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="min-h-11 rounded-[14px] border border-current px-4"
        >
          {t("confirmNo")}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await onDelete();
              if (result?.failed) setFailed(true);
            })
          }
          className="min-h-11 rounded-[14px] bg-on-alert px-4 font-semibold text-alert disabled:opacity-50"
        >
          {t("confirmYes")}
        </button>
      </div>
    </div>
  );
}
