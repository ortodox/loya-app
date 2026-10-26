"use client";

import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useActionState } from "react";
import { card, pill, ui } from "@/app/components/ui";
import { locales, type Locale } from "@/config/locales";
import { zoneGroups, type Zone } from "@/logic/catalog";
import type { TypeForm as TypeFormValues } from "@/logic/rules/catalog-form";
import { localized } from "@/logic/rules/catalog-settings";
import type { CatalogFormState } from "./actions";
import { AdviceEditor } from "./AdviceEditor";
import { SettingsFields } from "./SettingsFields";

type Props = {
  title: string;
  initial: TypeFormValues;
  zones: Zone[];
  cancelHref: string;
  action: (state: CatalogFormState<TypeFormValues>, fd: FormData) => Promise<CatalogFormState<TypeFormValues>>;
};

const nameKey = { ru: "nameRu", uk: "nameUk", pl: "namePl", en: "nameEn" } as const;

/** B1: procedure type – names, allowed zones, defaults and advice. */
export function TypeForm({ title, initial, zones, cancelHref, action }: Props) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const [state, formAction, pending] = useActionState(action, { values: initial });
  const v = state.values;
  const allowed = new Set(v.zoneIds ?? []);

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
        {locales.map((l) => (
          <label key={l} className="flex flex-col gap-2">
            <span className={card.label}>{t(`catalog.fields.${nameKey[l]}`)}</span>
            <input name={`name.${l}`} defaultValue={v.name?.[l] ?? ""} required={l === "ru"} className={ui.input} />
            {l === "ru" && state.errors?.nameRu && <p className={ui.error}>{t("catalog.errors.required")}</p>}
          </label>
        ))}
        <p className="text-sm text-muted">{t("catalog.nameHint")}</p>
      </section>

      <section className={`${card.surface} flex flex-col gap-4 p-4`}>
        <h2 className={card.heading}>{t("catalog.zones")}</h2>
        {zoneGroups.map((group) => {
          const inGroup = zones.filter((z) => z.group === group);
          if (inGroup.length === 0) return null;
          return (
            <fieldset key={group} className="flex flex-col gap-2">
              <legend className={`${card.label} mb-2`}>{t(`catalog.groups.${group}`)}</legend>
              <div className="flex flex-wrap gap-2">
                {inGroup.map((zone) => (
                  <label key={zone.id} className="cursor-pointer">
                    <input type="checkbox" name="zoneIds" value={zone.id} defaultChecked={allowed.has(zone.id)} className="peer sr-only" />
                    <span className={`${pill.base} ${pill.off} peer-checked:border-primary peer-checked:bg-primary peer-checked:text-on-primary peer-focus-visible:outline-2 peer-focus-visible:outline-accent`}>
                      {localized(zone.name, locale)}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          );
        })}
      </section>

      <section className={`${card.surface} flex flex-col gap-4 p-4`}>
        <h2 className={card.heading}>{t("catalog.defaults")}</h2>
        <p className="text-sm text-muted">{t("catalog.defaultsHint")}</p>
        <SettingsFields values={v} errors={state.errors} />
      </section>

      <section className={`${card.surface} flex flex-col gap-4 p-4`}>
        <h2 className={card.heading}>{t("catalog.fields.advice")}</h2>
        <AdviceEditor advice={v.advice ?? {}} review={v.adviceReview ?? []} />
      </section>

      {state.failed && <p className={ui.error}>{t("form.saveFailed")}</p>}
      <button type="submit" disabled={pending} className={ui.button}>
        {t("form.save")}
      </button>
    </form>
  );
}
