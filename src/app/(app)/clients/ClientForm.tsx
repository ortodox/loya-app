"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useActionState, useState } from "react";
import { card, sectionSummary, sectionTitle, ui } from "@/app/components/ui";
import { locales } from "@/config/locales";
import type { CountryOption } from "@/logic/rules/country";
import { AnamnesisFields } from "./AnamnesisFields";
import type { ClientForm as ClientFormValues, ClientFormField } from "@/logic/rules/client-input";
import type { ClientFormState } from "./actions";

type Props = {
  title: string;
  /** Country list built on the server, so names match between server and browser ICU data. */
  countries: { common: CountryOption[]; other: CountryOption[] };
  /** Open clinical sections that already have content (edit), or keep them closed (new). */
  openFilled?: boolean;
  initial: ClientFormValues;
  cancelHref: string;
  action: (state: ClientFormState, formData: FormData) => Promise<ClientFormState>;
};

export function ClientForm({ title, initial, cancelHref, action, countries, openFilled = false }: Props) {
  const t = useTranslations();
  const [state, formAction, pending] = useActionState(action, { values: initial });
  const [ageMode, setAgeMode] = useState<"age" | "birthDate">(
    initial.birthDate ? "birthDate" : "age",
  );
  const v = state.values;
  const error = (field: ClientFormField) => {
    const key = state.errors?.[field];
    return key ? <p className={ui.error}>{t(`form.errors.${key}`)}</p> : null;
  };

  return (
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

      <details open className="group flex flex-col">
        <summary className={sectionSummary}>{t("karta.sections.generalData")}</summary>
        <div className="flex flex-col gap-5 pt-3">
      <label className="flex flex-col gap-2">
        <span className={card.label}>
          {t("form.fullName")} <span className="text-xs">({t("form.required")})</span>
        </span>
        <input name="fullName" required autoComplete="off" defaultValue={v.fullName} className={ui.input} />
        {error("fullName")}
      </label>

      <label className="flex flex-col gap-2">
        <span className={card.label}>{t("form.date")}</span>
        <input name="cardDate" type="date" defaultValue={v.cardDate} className={ui.input} />
        {error("cardDate")}
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className={`${card.label} mb-2`}>{t("form.ageMode")}</legend>
        <div className="grid grid-cols-2 rounded-xl bg-neutral-100 p-1 text-sm dark:bg-neutral-900">
          {(["age", "birthDate"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              aria-pressed={ageMode === mode}
              onClick={() => setAgeMode(mode)}
              className="rounded-lg py-2 aria-pressed:bg-white aria-pressed:font-medium aria-pressed:shadow-sm dark:aria-pressed:bg-neutral-700"
            >
              {t(`form.${mode}`)}
            </button>
          ))}
        </div>
        {ageMode === "age" ? (
          <input
            key="age"
            name="age"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={3}
            aria-label={t("form.age")}
            defaultValue={v.age}
            className={ui.input}
          />
        ) : (
          <input
            key="birthDate"
            name="birthDate"
            type="date"
            aria-label={t("form.birthDate")}
            defaultValue={v.birthDate}
            className={ui.input}
          />
        )}
        {error("age")}
        {error("birthDate")}
      </fieldset>

      <label className="flex flex-col gap-2">
        <span className={card.label}>{t("form.phone")}</span>
        <input name="phone" type="tel" autoComplete="off" defaultValue={v.phone} className={ui.input} />
      </label>

      <label className="flex flex-col gap-2">
        <span className={card.label}>{t("form.email")}</span>
        <input
          name="email"
          type="email"
          inputMode="email"
          autoComplete="off"
          autoCapitalize="none"
          defaultValue={v.email}
          className={ui.input}
        />
        {error("email")}
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className={`${card.label} mb-2`}>{t("card.fields.residence")}</legend>
        <select
          name="residenceCountry"
          aria-label={t("form.residenceCountry")}
          defaultValue={v.residenceCountry ?? ""}
          className={ui.input}
        >
          <option value="">{t("form.countryNone")}</option>
          <optgroup label={t("form.countryCommon")}>
            {countries.common.map((c) => (
              <option key={c.code} value={c.code}>
                {c.flag} {c.name}
              </option>
            ))}
          </optgroup>
          <optgroup label={t("form.countryOther")}>
            {countries.other.map((c) => (
              <option key={c.code} value={c.code}>
                {c.flag} {c.name}
              </option>
            ))}
          </optgroup>
        </select>
        {error("residenceCountry")}
        <input
          name="residenceCity"
          placeholder={t("form.residenceCity")}
          aria-label={t("form.residenceCity")}
          autoComplete="off"
          defaultValue={v.residenceCity}
          className={ui.input}
        />
      </fieldset>

      <label className="flex flex-col gap-2">
        <span className={card.label}>{t("form.language")}</span>
        <select name="language" defaultValue={v.language || "ru"} className={ui.input}>
          {locales.map((l) => (
            <option key={l} value={l}>
              {t(`language.${l}`)}
            </option>
          ))}
        </select>
      </label>
        </div>
      </details>

      <AnamnesisFields values={v.anamnesis ?? {}} openFilled={openFilled} />

      <label className="flex flex-col gap-2">
        <span className={sectionTitle}>{t("form.notes")}</span>
        <textarea name="notes" rows={8} defaultValue={v.notes} className={ui.input} />
      </label>

      {state.failed && <p className={ui.error}>{t("form.saveFailed")}</p>}
      <button type="submit" disabled={pending} className={ui.button}>
        {t("form.save")}
      </button>
    </form>
  );
}
