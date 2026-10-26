"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useActionState } from "react";
import { card, ui } from "@/app/components/ui";
import type { Localized } from "@/logic/catalog";
import type { PreparationForm as PreparationFormValues } from "@/logic/rules/catalog-form";
import type { SettingGroup } from "@/logic/rules/catalog-settings";
import type { CatalogFormState } from "./actions";
import { AdviceEditor } from "./AdviceEditor";
import { SettingsFields } from "./SettingsFields";

type Props = {
  title: string;
  initial: PreparationFormValues;
  types: { id: string; name: string }[];
  /** The type's values (P3/P5), shown as grey help text next to the own values. */
  inherited: Partial<Record<SettingGroup, string | null>>;
  inheritedAdvice: Localized | null;
  cancelHref: string;
  action: (
    state: CatalogFormState<PreparationFormValues>,
    fd: FormData,
  ) => Promise<CatalogFormState<PreparationFormValues>>;
};

/** P1/P2: name, manufacturer, favourite, type; «Свои значения» override the type (P3/P5). */
export function PreparationForm({ title, initial, types, inherited, inheritedAdvice, cancelHref, action }: Props) {
  const t = useTranslations();
  const [state, formAction, pending] = useActionState(action, { values: initial });
  const v = state.values;
  const error = (field: string) =>
    state.errors?.[field] ? <p className={ui.error}>{t(`catalog.errors.${state.errors[field]}`)}</p> : null;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <header className="flex items-center justify-between gap-4">
        <Link href={cancelHref} className={ui.textButton}>
          {t("form.cancel")}
        </Link>
        <h1 className="text-center font-serif text-2xl text-ink">{title}</h1>
        <button type="submit" disabled={pending} className={`${ui.textButton} font-semibold disabled:opacity-50`}>
          {t("form.save")}
        </button>
      </header>

      <section className={`${card.surface} flex flex-col gap-4 p-4`}>
        <label className="flex flex-col gap-2">
          <span className={card.label}>
            {t("catalog.fields.name")} <span className="text-xs">({t("form.required")})</span>
          </span>
          <input name="name" required autoComplete="off" defaultValue={v.name} className={ui.input} />
          {error("name")}
        </label>
        <label className="flex flex-col gap-2">
          <span className={card.label}>{t("catalog.fields.manufacturer")}</span>
          <input name="manufacturer" autoComplete="off" defaultValue={v.manufacturer} className={ui.input} />
        </label>
        <label className="flex flex-col gap-2">
          <span className={card.label}>{t("catalog.fields.type")}</span>
          <select name="procedureTypeId" defaultValue={v.procedureTypeId} className={ui.input}>
            {types.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </select>
          {error("procedureTypeId")}
        </label>
        <label className="flex min-h-11 items-center gap-3 text-base text-ink">
          <input type="checkbox" name="favorite" value="on" defaultChecked={v.favorite === "on"} className="size-5 accent-[var(--accent)]" />
          ⭐ {t("catalog.favorite")}
        </label>
      </section>

      <section className={`${card.surface} flex flex-col gap-4 p-4`}>
        <h2 className={card.heading}>{t("catalog.ownValues")}</h2>
        <p className="text-sm text-muted">{t("catalog.ownValuesHint")}</p>
        <SettingsFields values={v} errors={state.errors} inherited={inherited} />
      </section>

      <section className={`${card.surface} flex flex-col gap-4 p-4`}>
        <h2 className={card.heading}>{t("catalog.fields.advice")}</h2>
        <AdviceEditor advice={v.advice ?? {}} review={v.adviceReview ?? []} inherited={inheritedAdvice} />
      </section>

      {state.failed && <p className={ui.error}>{t("form.saveFailed")}</p>}
      <button type="submit" disabled={pending} className={ui.button}>
        {t("form.save")}
      </button>
    </form>
  );
}
