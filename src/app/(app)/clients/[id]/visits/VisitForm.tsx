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
  const [state, formAction, pending] = useActionState(action, { values: initial });
  const v = state.values;

  return (
    <div className="flex flex-col gap-8">
      <form action={formAction} className="flex flex-col gap-5">
        <header className="flex items-center justify-between gap-4">
          <Link href={cancelHref} className="text-base text-neutral-500 dark:text-neutral-400">
            {t("form.cancel")}
          </Link>
          <h1 className="text-lg font-semibold">{title}</h1>
          <button type="submit" disabled={pending} className="text-base font-semibold disabled:opacity-50">
            {t("form.save")}
          </button>
        </header>

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
        className="text-base text-red-600 dark:text-red-400"
      >
        {t("delete")}
      </button>
    );
  }

  return (
    <div
      role="alertdialog"
      aria-label={t("delete")}
      className="flex flex-col gap-3 rounded-2xl border border-red-300 bg-red-50 p-4 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100"
    >
      <p>{t("confirmDelete")}</p>
      {failed && <p className="text-sm">{t("deleteFailed")}</p>}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="rounded-xl border border-red-300 px-4 py-3 dark:border-red-800"
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
          className="rounded-xl bg-red-600 px-4 py-3 font-medium text-white disabled:opacity-50"
        >
          {t("confirmYes")}
        </button>
      </div>
    </div>
  );
}
