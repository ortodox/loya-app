"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { card, ui } from "@/app/components/ui";
import { intervalUnits } from "@/logic/catalog";
import type { CatalogFormErrors, SettingsForm } from "@/logic/rules/catalog-form";
import type { SettingGroup } from "@/logic/rules/catalog-settings";

type Props = {
  values: SettingsForm;
  errors?: CatalogFormErrors;
  /** On a preparation: the type's value per group, shown as grey help text (P3). */
  inherited?: Partial<Record<SettingGroup, string | null>>;
};

const small = `${ui.input} text-center`;

/** P3: dose, course, interval, maintenance and follow-up. Every field is optional. */
export function SettingsFields({ values, errors, inherited }: Props) {
  const t = useTranslations("catalog");
  const [controlMode, setControlMode] = useState(values.controlMode ?? "");
  const error = (field: string) =>
    errors?.[field] ? <p className={ui.error}>{t(`errors.${errors[field]}`)}</p> : null;
  const hint = (group: SettingGroup) =>
    inherited ? (
      <p className="text-sm text-muted">{t("typeValue", { value: inherited[group] ?? t("toFill") })}</p>
    ) : null;
  const unitSelect = (name: "intervalUnit" | "maintenanceUnit") => (
    <select name={name} defaultValue={values[name] ?? ""} aria-label={t("fields.unit")} className={ui.input}>
      <option value="">{t("units.none")}</option>
      {intervalUnits.map((u) => (
        <option key={u} value={u}>
          {t(`units.${u}`)}
        </option>
      ))}
    </select>
  );
  const minMax = (min: "courseMin" | "intervalMin" | "maintenanceMin", max: "courseMax" | "intervalMax" | "maintenanceMax") => (
    <div className="grid grid-cols-2 gap-2">
      <input name={min} inputMode="numeric" placeholder={t("fields.min")} aria-label={t("fields.min")} defaultValue={values[min]} className={small} />
      <input name={max} inputMode="numeric" placeholder={t("fields.max")} aria-label={t("fields.max")} defaultValue={values[max]} className={small} />
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      <fieldset className="flex flex-col gap-2">
        <legend className={`${card.label} mb-2`}>{t("fields.dose")}</legend>
        <div className="grid grid-cols-[1fr_1fr] gap-2">
          <input name="doseText" placeholder={t("fields.doseText")} aria-label={t("fields.doseText")} defaultValue={values.doseText} className={ui.input} />
          <input name="doseUnit" placeholder={t("fields.unit")} aria-label={t("fields.doseUnit")} defaultValue={values.doseUnit} className={ui.input} />
        </div>
        {hint("dose")}
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className={`${card.label} mb-2`}>{t("fields.course")}</legend>
        {minMax("courseMin", "courseMax")}
        {error("courseMin")}
        {error("courseMax")}
        {hint("course")}
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className={`${card.label} mb-2`}>{t("fields.interval")}</legend>
        {minMax("intervalMin", "intervalMax")}
        {unitSelect("intervalUnit")}
        {error("intervalMin")}
        {error("intervalMax")}
        {error("intervalUnit")}
        {hint("interval")}
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className={`${card.label} mb-2`}>{t("fields.maintenance")}</legend>
        {minMax("maintenanceMin", "maintenanceMax")}
        {unitSelect("maintenanceUnit")}
        <label className="flex min-h-11 items-center gap-3 text-base text-ink">
          <input
            type="checkbox"
            name="maintenanceAsNeeded"
            value="on"
            defaultChecked={values.maintenanceAsNeeded === "on"}
            className="size-5 accent-[var(--accent)]"
          />
          {t("fields.asNeeded")}
        </label>
        {error("maintenanceMin")}
        {error("maintenanceMax")}
        {error("maintenanceUnit")}
        {hint("maintenance")}
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className={`${card.label} mb-2`}>{t("fields.control")}</legend>
        <select
          name="controlMode"
          value={controlMode}
          onChange={(e) => setControlMode(e.target.value)}
          aria-label={t("fields.control")}
          className={ui.input}
        >
          <option value="">{t("controlModes.empty")}</option>
          <option value="none">{t("controlModes.none")}</option>
          <option value="days">{t("controlModes.days")}</option>
        </select>
        {controlMode === "days" && (
          <input
            name="controlDays"
            inputMode="numeric"
            placeholder={t("fields.controlDays")}
            aria-label={t("fields.controlDays")}
            defaultValue={values.controlDays}
            className={ui.input}
          />
        )}
        {error("controlDays")}
        {hint("control")}
      </fieldset>
    </div>
  );
}
