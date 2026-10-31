"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useActionState } from "react";
import { ui } from "@/app/components/ui";
import type { AnamnesisForm } from "@/logic/rules/anamnesis";
import { AnamnesisFields } from "../../AnamnesisFields";

type Props = {
  cancelHref: string;
  section: string;
  values: AnamnesisForm;
  action: (state: { failed?: boolean }, fd: FormData) => Promise<{ failed?: boolean }>;
};

/** AN3: one section of «Анкета» on its own – e.g. only «Состояние здоровья» when the medications change. */
export function AnamnesisSectionForm({ cancelHref, section, values, action }: Props) {
  const t = useTranslations();
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <header className="flex items-center justify-between gap-4">
        <Link href={cancelHref} className={ui.textButton}>
          {t("form.cancel")}
        </Link>
        <h1 className="text-center font-serif text-2xl text-ink">{t(`karta.sections.${section}`)}</h1>
        <button type="submit" disabled={pending} className={`${ui.textButton} font-semibold disabled:opacity-50`}>
          {t("form.save")}
        </button>
      </header>
      <AnamnesisFields values={values} openFilled only={section} />
      {state.failed && <p className={ui.error}>{t("form.saveFailed")}</p>}
      <button type="submit" disabled={pending} className={ui.button}>
        {t("form.save")}
      </button>
    </form>
  );
}
