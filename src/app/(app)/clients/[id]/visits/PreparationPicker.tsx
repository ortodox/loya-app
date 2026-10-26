"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { card, ui } from "@/app/components/ui";
import { matchesPreparation } from "@/logic/rules/catalog-list";

export type PickerOption = {
  id: string;
  name: string;
  manufacturer: string | null;
  favorite: boolean;
  typeName: string;
};

type Props = {
  options: PickerOption[];
  types: { id: string; name: string }[];
  onPick: (preparationId: string) => void;
  onManual: (name: string, typeId: string) => void;
  onClose: () => void;
};

/** R1: search the catalogue (favourites first) or «Добавить вручную» with a procedure type. */
export function PreparationPicker({ options, types, onPick, onManual, onClose }: Props) {
  const t = useTranslations("visits");
  const [query, setQuery] = useState("");
  const [manual, setManual] = useState(false);
  const [name, setName] = useState("");
  const [typeId, setTypeId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const shown = options.filter((o) => matchesPreparation(o, query)).slice(0, 40);

  return (
    <div className={`${card.surface} flex flex-col gap-3 border border-field p-3`}>
      {!manual ? (
        <>
          <input
            type="search"
            autoFocus
            enterKeyHint="search"
            placeholder={t("searchPreparation")}
            aria-label={t("searchPreparation")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className={ui.input}
          />
          <ul className="max-h-72 overflow-y-auto rounded-[14px] border border-line">
            {shown.map((o) => (
              <li key={o.id} className="border-b border-line last:border-b-0">
                <button
                  type="button"
                  onClick={() => onPick(o.id)}
                  className="flex min-h-11 w-full flex-col items-start px-3 py-2 text-left"
                >
                  <span className="text-base font-semibold text-ink">
                    {o.favorite && "⭐ "}
                    {o.name}
                  </span>
                  <span className="text-sm text-muted">{[o.manufacturer, o.typeName].filter(Boolean).join(" · ")}</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button type="button" onClick={() => setManual(true)} className={ui.textButton}>
              {t("addManual")}
            </button>
            <button type="button" onClick={onClose} className={ui.textButton}>
              {t("close")}
            </button>
          </div>
        </>
      ) : (
        <>
          <label className="flex flex-col gap-2">
            <span className={card.label}>{t("manualName")}</span>
            <input value={name} autoFocus onChange={(e) => setName(e.target.value)} className={ui.input} />
          </label>
          <label className="flex flex-col gap-2">
            <span className={card.label}>{t("manualType")}</span>
            <select value={typeId} onChange={(e) => setTypeId(e.target.value)} className={ui.input}>
              <option value="">—</option>
              {types.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
          </label>
          <p className="text-sm text-muted">{t("manualHint")}</p>
          {error && <p className={ui.error}>{error}</p>}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button type="button" onClick={() => setManual(false)} className={ui.textButton}>
              ‹ {t("searchPreparation")}
            </button>
            <button
              type="button"
              className={ui.addButton}
              onClick={() => {
                if (!name.trim()) return setError(t("errors.manualNameRequired"));
                if (!typeId) return setError(t("errors.manualTypeRequired"));
                onManual(name.trim(), typeId);
              }}
            >
              {t("add")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
