"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useActionState } from "react";
import { card, ui } from "@/app/components/ui";

type Props = { cancelHref: string; notes: string; action: (state: { failed?: boolean }, fd: FormData) => Promise<{ failed?: boolean }> };

/** ZM1 «Заметки»: free notes about the client, saved on their own (nothing else of the client changes). */
export function NotesForm({ cancelHref, notes, action }: Props) {
  const t = useTranslations();
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <header className="flex items-center justify-between gap-4">
        <Link href={cancelHref} className={ui.textButton}>
          {t("form.cancel")}
        </Link>
        <h1 className="text-center font-serif text-2xl text-ink">{t("card.notes")}</h1>
        <button type="submit" disabled={pending} className={`${ui.textButton} font-semibold disabled:opacity-50`}>
          {t("form.save")}
        </button>
      </header>
      <section className={`${card.surface} flex flex-col gap-2 p-4`}>
        <label className="flex flex-col gap-2">
          <span className={card.label}>{t("card.notes")}</span>
          <textarea name="notes" defaultValue={notes} rows={10} autoFocus className={`${ui.input} min-h-48`} />
        </label>
        {state.failed && <p className={ui.error}>{t("notes.failed")}</p>}
      </section>
      <button type="submit" disabled={pending} className={ui.button}>
        {t("form.save")}
      </button>
    </form>
  );
}
