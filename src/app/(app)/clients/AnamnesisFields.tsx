"use client";

import { useTranslations } from "next-intl";
import { card, sectionSummary, ui } from "@/app/components/ui";
import { clinicalSections } from "@/config/kartaTemplate";
import { sectionHasContent, type AnamnesisForm } from "@/logic/rules/anamnesis";

/** JA1, AN1, AN2, SK1, VI1, PH1: one generic form built from the template. */
export function AnamnesisFields({ values, openFilled }: { values: AnamnesisForm; openFilled: boolean }) {
  const t = useTranslations("karta");

  return clinicalSections.map((section) => (
    <details
      key={section.key}
      open={openFilled && sectionHasContent(section.fields, values)}
      className="group flex flex-col border-t border-neutral-200 pt-4 dark:border-neutral-800"
    >
      <summary className={sectionSummary}>{t(`sections.${section.key}`)}</summary>
      <div className="flex flex-col gap-5 pt-3">
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
                      <span className="block rounded-full border border-neutral-300 px-3 py-1.5 text-sm peer-checked:border-neutral-900 peer-checked:bg-neutral-900 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-neutral-400 dark:border-neutral-700 dark:peer-checked:border-neutral-100 dark:peer-checked:bg-neutral-100 dark:peer-checked:text-neutral-900">
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
