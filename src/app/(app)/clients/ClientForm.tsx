"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { applySnapshot, clearDraft, readDraft, snapshotForm, writeDraft } from "@/app/components/draft";
import { Chevron } from "@/app/components/Icons";
import { card, disclosure, formSection, pill, ui } from "@/app/components/ui";
import { locales } from "@/config/locales";
import { directions } from "@/logic/course";
import type { CountryOption } from "@/logic/rules/country";
import { AnamnesisFields } from "./AnamnesisFields";
import type { ClientForm as ClientFormValues, ClientFormField } from "@/logic/rules/client-input";
import type { FormSnapshot } from "@/logic/rules/drafts";
import { snapshotDiffers } from "@/logic/rules/drafts";
import type { ClientFormState } from "./actions";

type Props = {
  title: string;
  /** Country list built on the server, so names match between server and browser ICU data. */
  countries: { common: CountryOption[]; other: CountryOption[] };
  /** Open clinical sections that already have content (edit), or keep them closed (new). */
  openFilled?: boolean;
  initial: ClientFormValues;
  cancelHref: string;
  /** DR1: set for «Новый клиент» – unsaved text is kept on this phone until it is saved. */
  draftKey?: string;
  action: (state: ClientFormState, formData: FormData) => Promise<ClientFormState>;
};

export function ClientForm({ title, initial, cancelHref, action, countries, openFilled = false, draftKey }: Props) {
  const t = useTranslations();
  const [state, formAction, pending] = useActionState(action, {
    values: initial,
  });
  const [ageMode, setAgeMode] = useState<"age" | "birthDate">(initial.birthDate ? "birthDate" : "age");
  const v = state.values;
  const formRef = useRef<HTMLFormElement>(null);
  const defaults = useRef<FormSnapshot | null>(null);
  const [pendingDraft, setPendingDraft] = useState<FormSnapshot | null>(null);
  const [restored, setRestored] = useState(false);

  // DR1: bring back an unsaved draft (after a phone call or when the app was closed).
  useEffect(() => {
    if (!draftKey || !formRef.current) return;
    defaults.current = snapshotForm(formRef.current);
    const draft = readDraft<FormSnapshot>(draftKey);
    if (!draft?.values) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser storage can only be read after hydration
    if (draft.values.birthDate) setAgeMode("birthDate");
    setPendingDraft(draft);
  }, [draftKey]);

  // Applied after the age / birth date field for the draft is on screen.
  useEffect(() => {
    if (!pendingDraft || !formRef.current) return;
    applySnapshot(formRef.current, pendingDraft);
    setPendingDraft(null);
    setRestored(true);
  }, [pendingDraft, ageMode]);

  function saveDraft() {
    if (!draftKey || !formRef.current || !defaults.current) return;
    const snapshot = snapshotForm(formRef.current);
    if (snapshotDiffers(snapshot, defaults.current)) writeDraft(draftKey, snapshot);
    else clearDraft(draftKey);
  }

  // The draft is cleared on submit; keep it again when saving failed.
  useEffect(() => {
    if (state.errors || state.failed) saveDraft();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the save result changes
  }, [state]);

  const error = (field: ClientFormField) => {
    const key = state.errors?.[field];
    return key ? <p className={ui.error}>{t(`form.errors.${key}`)}</p> : null;
  };

  return (
    <form
      ref={formRef}
      action={formAction}
      onInput={saveDraft}
      onChange={saveDraft}
      onSubmit={() => draftKey && clearDraft(draftKey)}
      className="flex flex-col gap-4"
    >
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

      {restored && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-[14px] border border-field px-4 py-1 text-sm text-ink">
          <span>{t("draft.restored")}</span>
          <button
            type="button"
            onClick={() => {
              if (draftKey) clearDraft(draftKey);
              formRef.current?.reset();
              setAgeMode(initial.birthDate ? "birthDate" : "age");
              setRestored(false);
            }}
            className={`${ui.textButton} text-sm`}
          >
            {t("draft.discard")}
          </button>
        </div>
      )}

      <details open className={formSection.card}>
        <summary className={formSection.summary}>
          {t("karta.sections.generalData")}
          <Chevron className={disclosure.chevron} />
        </summary>
        <div className={formSection.body}>
          <label className="flex flex-col gap-2">
            <span className={card.label}>
              {t("form.fullName")} <span className="text-xs">({t("form.required")})</span>
            </span>
            <input
              name="fullName"
              required
              autoComplete="off"
              defaultValue={v.fullName}
              className={ui.input}
            />
            {error("fullName")}
          </label>

          <label className="flex flex-col gap-2">
            <span className={card.label}>{t("form.date")}</span>
            <input name="cardDate" type="date" defaultValue={v.cardDate} className={ui.input} />
            {error("cardDate")}
          </label>

          <fieldset className="flex flex-col gap-2">
            <legend className={`${card.label} mb-2`}>{t("form.ageMode")}</legend>
            <div className="grid grid-cols-2 rounded-[14px] border border-field p-1 text-sm">
              {(["age", "birthDate"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={ageMode === mode}
                  onClick={() => setAgeMode(mode)}
                  className="min-h-11 rounded-[10px] text-ink aria-pressed:bg-primary aria-pressed:font-semibold aria-pressed:text-on-primary"
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

          {/* DM1: «Косметология», «Дерматология» or both. */}
          <fieldset className="flex flex-col gap-2">
            <legend className={`${card.label} mb-2`}>{t("direction.label")}</legend>
            <div className="flex flex-wrap gap-2">
              {directions.map((d) => (
                <label key={d} className="cursor-pointer">
                  <input
                    type="checkbox"
                    name="direction"
                    value={d}
                    defaultChecked={(v.direction ?? []).includes(d)}
                    className="peer sr-only"
                  />
                  <span className={`${pill.base} ${pill.off} peer-checked:border-primary peer-checked:bg-primary peer-checked:text-on-primary peer-focus-visible:ring-2`}>
                    {t(`direction.${d}`)}
                  </span>
                </label>
              ))}
            </div>
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

      <label className={`${card.surface} flex flex-col gap-3 p-4`}>
        <span className={card.heading}>{t("form.procedurePlan")}</span>
        <textarea name="procedurePlan" rows={5} defaultValue={v.procedurePlan} className={ui.input} />
      </label>

      <label className={`${card.surface} flex flex-col gap-3 p-4`}>
        <span className={card.heading}>{t("form.notes")}</span>
        <textarea name="notes" rows={8} defaultValue={v.notes} className={ui.input} />
      </label>

      {state.failed && <p className={ui.error}>{t("form.saveFailed")}</p>}
      <button type="submit" disabled={pending} className={ui.button}>
        {t("form.save")}
      </button>
    </form>
  );
}
