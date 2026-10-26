import { getTranslations } from "next-intl/server";
import { card, ui } from "@/app/components/ui";
import type { CatalogSettings } from "@/logic/catalog";
import type { SettingGroup, SettingSource } from "@/logic/rules/catalog-settings";
import { describeSettings, valueGroups } from "./format";

/** P3: label/value rows; empty values show a clear «заполнить»; on a preparation, where each value comes from. */
export async function SettingsRows({
  settings,
  source,
}: {
  settings: CatalogSettings;
  source?: Record<SettingGroup, SettingSource>;
}) {
  const t = await getTranslations("catalog");
  const values = describeSettings(t, settings);
  return (
    <dl>
      {valueGroups.map((group) => (
        <div key={group} className={card.row}>
          <dt className="flex items-center justify-between gap-3 text-sm text-muted">
            {t(`fields.${group}`)}
            {source && (
              <span className={source[group] === "preparation" ? "text-xs font-semibold text-accent" : "text-xs text-muted"}>
                {source[group] === "preparation" ? t("own") : t("fromType")}
              </span>
            )}
          </dt>
          <dd className="text-base text-ink">
            {values[group] ?? <span className={ui.alertTag}>{t("toFill")}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}
