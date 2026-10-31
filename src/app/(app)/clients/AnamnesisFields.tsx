"use client";

import { useTranslations } from "next-intl";
import { Chevron } from "@/app/components/Icons";
import { card, disclosure, formSection, pill, ui } from "@/app/components/ui";
import { clinicalSections } from "@/config/kartaTemplate";
import { sectionHasContent, type AnamnesisForm } from "@/logic/rules/anamnesis";

/** JA1, AN1, AN2, SK1, VI1, PH1: one generic form built from the template. */
export function AnamnesisFields({ values, openFilled, only }: { values: AnamnesisForm; openFilled: boolean; only?: string }) {
  const t = useTranslations("karta");

  // AN3: «only» shows one section, open, for editing it on its own.
  return clinicalSections.filter((s) => !only || s.key === only).map((section) => (
    <details
      key={section.key}
      open={only !== undefined || (openFilled && sectionHasContent(section.fields, values))}
      className={formSection.card}
    >
      <summary className={formSection.summary}>
        {t(`sections.${section.key}`)}
        <Chevron className={disclosure.chevron} />
      </summary>
      <div className={formSection.body}>
        {section.fields.map((field) => {
          const value = values[field.key] ?? {};
          const ticked = new Set(value.choices ?? []);
          const name = `anamnesis.${field.key}`;
          // A section with one field of the same name (Жалобы) needs no second label.
          const showLabel = section.fields.length > 1 || field.key !== section.key;
          return (
            <fieldset key={field.key} className="flex flex-col gap-2">
              <legend className={`${card.label} mb-2 ${showLabel ? "" : "sr-only"}`}>
                {t(`fields.${field.key}`)}
              </legend>
              {field.options.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {field.options.map((option) => (
                    <label key={option} className="cursor-pointer">
                      <input
                        type="checkbox"
                        name={`${name}.choices`}
                        value={option}
                        defaultChecked={ticked.has(option)}
                        className="peer sr-only"
                      />
                      <span className={`${pill.base} ${pill.off} peer-checked:border-primary peer-checked:bg-primary peer-checked:text-on-primary peer-focus-visible:outline-2 peer-focus-visible:outline-accent`}>
                        {t(`options.${field.key}.${option}`)}
                      </span>
                    </label>
                  ))}
                </div>
              )}
              <textarea
                name={`${name}.text`}
                rows={field.options.length > 0 ? 1 : 2}
                placeholder={t("freeText")}
                aria-label={t(`fields.${field.key}`)}
                defaultValue={value.text ?? ""}
                className={ui.input}
              />
            </fieldset>
          );
        })}
      </div>
    </details>
  ));
}
