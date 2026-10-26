"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useActionState, useMemo, useRef, useState, useTransition } from "react";
import { WarningIcon } from "@/app/components/Icons";
import { card, ui } from "@/app/components/ui";
import type { Locale } from "@/config/locales";
import type { Localized } from "@/logic/catalog";
import { mergeRecommendations, recommendationUpdate } from "@/logic/rules/recommendations";
import type { SafetyAlert } from "@/logic/rules/safety-alert";
import type { VisitFormState } from "./actions";
import { PhotoField, type ExistingPhoto, type NewPhoto } from "./PhotoField";
import { PreparationPicker, type PickerOption } from "./PreparationPicker";

export type FormOption = PickerOption & { procedureTypeId: string; doseHint: string | null; advice: Localized | null };
export type FormType = { id: string; name: string; doseHint: string | null; advice: Localized | null };

/** One preparation row: from the catalogue (preparationId) or typed in by hand (manual*). */
export type ItemState = {
  key: string;
  preparationId: string | null;
  manualName: string | null;
  manualTypeId: string | null;
  quantity: string;
};

export type VisitFormInitial = {
  visitDate: string;
  notes: string;
  recommendations: string;
  items: ItemState[];
  photos: ExistingPhoto[];
};

type Props = {
  title: string;
  cancelHref: string;
  initial: VisitFormInitial;
  options: FormOption[];
  types: FormType[];
  language: Locale;
  alerts: SafetyAlert[];
  action: (state: VisitFormState, fd: FormData) => Promise<VisitFormState>;
  onDelete?: () => Promise<{ failed: true }>;
};

/** VS1 «Новый визит»: date, preparations + quantity, sticker photos, notes, post-procedure advice. */
export function VisitForm({ title, cancelHref, initial, options, types, language, alerts, action, onDelete }: Props) {
  const t = useTranslations();
  const [state, formAction, pending] = useActionState(action, { values: {} });
  const [, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const optionById = useMemo(() => new Map(options.map((o) => [o.id, o])), [options]);
  const typeById = useMemo(() => new Map(types.map((x) => [x.id, x])), [types]);
  const suggest = (rows: ItemState[]) =>
    mergeRecommendations(
      rows.map((r) => (r.preparationId ? optionById.get(r.preparationId)?.advice ?? null : typeById.get(r.manualTypeId ?? "")?.advice ?? null)),
      language,
    );

  const [items, setItems] = useState<ItemState[]>(initial.items);
  const [picking, setPicking] = useState(initial.items.length === 0);
  const [recommendations, setRecommendations] = useState(initial.recommendations);
  const [lastSuggested, setLastSuggested] = useState(() => suggest(initial.items));
  const [askWith, setAskWith] = useState<string | null>(null);
  const [removedPhotos, setRemovedPhotos] = useState<string[]>([]);
  const [newPhotos, setNewPhotos] = useState<NewPhoto[]>([]);

  /** P5: refill the advice from the catalogue, unless the doctor has edited it – then ask. */
  function changeItems(next: ItemState[]) {
    setItems(next);
    const suggestion = suggest(next);
    const decision = recommendationUpdate(recommendations, lastSuggested, suggestion);
    if (decision === "replace") {
      setRecommendations(suggestion);
      setLastSuggested(suggestion);
      setAskWith(null);
    } else if (decision === "ask") {
      setAskWith(suggestion);
    } else {
      setLastSuggested(suggestion);
      setAskWith(null);
    }
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set(
      "items",
      JSON.stringify(
        items.map((i) => ({
          preparationId: i.preparationId ?? undefined,
          manualName: i.manualName ?? undefined,
          manualTypeId: i.manualTypeId ?? undefined,
          quantity: i.quantity,
        })),
      ),
    );
    fd.set("recommendationsLang", language);
    for (const p of newPhotos) fd.append("photos", new File([p.blob], `${p.key}.jpg`, { type: "image/jpeg" }));
    for (const id of removedPhotos) fd.append("removePhotoIds", id);
    startTransition(() => formAction(fd));
  }

  const error = (key: "visitDate" | "items" | "photos") =>
    state.errors?.[key] ? (
      <p className={ui.error}>{key === "visitDate" ? t("visits.dateInvalid") : t(`visits.errors.${state.errors[key]}`)}</p>
    ) : null;

  return (
    <div className="flex flex-col gap-8">
      <form ref={formRef} onSubmit={submit} className="flex flex-col gap-4">
        <header className="flex items-center justify-between gap-4">
          <Link href={cancelHref} className={ui.textButton}>
            {t("form.cancel")}
          </Link>
          <h1 className="text-center font-serif text-2xl text-ink">{title}</h1>
          <button type="submit" disabled={pending} className={`${ui.textButton} font-semibold disabled:opacity-50`}>
            {t("form.save")}
          </button>
        </header>

        <section className={`${card.surface} flex flex-col gap-2 p-4`}>
          <label className="flex flex-col gap-2">
            <span className={card.label}>{t("visits.date")}</span>
            <input name="visitDate" type="date" required defaultValue={initial.visitDate} className={ui.input} />
          </label>
          {error("visitDate")}
        </section>

        {/* R1/DO1: one or more preparations, each with a free-text quantity. */}
        <section className={`${card.surface} flex flex-col gap-3 p-4`}>
          <h2 className={card.heading}>{t("visits.preparations")}</h2>
          {items.length === 0 && !picking && <p className={ui.muted}>{t("visits.noPreparations")}</p>}
          <ul className="flex flex-col gap-3">
            {items.map((item, index) => {
              const option = item.preparationId ? optionById.get(item.preparationId) : null;
              const type = typeById.get(option?.procedureTypeId ?? item.manualTypeId ?? "");
              const hint = option?.doseHint ?? type?.doseHint ?? null;
              return (
                <li key={item.key} className="flex flex-col gap-2 rounded-[14px] border border-line p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-col">
                      <span className="text-base font-semibold text-ink">
                        {option?.favorite && "⭐ "}
                        {option?.name ?? item.manualName}
                      </span>
                      <span className="text-sm text-muted">
                        {[type?.name, item.preparationId ? null : t("visits.manual")].filter(Boolean).join(" · ")}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => changeItems(items.filter((_, i) => i !== index))}
                      className="inline-flex min-h-11 shrink-0 items-center text-sm text-on-alert"
                    >
                      {t("visits.remove")}
                    </button>
                  </div>
                  <label className="flex flex-col gap-1">
                    <span className={card.label}>{t("visits.quantity")}</span>
                    <input
                      value={item.quantity}
                      onChange={(e) =>
                        setItems(items.map((x, i) => (i === index ? { ...x, quantity: e.target.value } : x)))
                      }
                      placeholder={hint ?? ""}
                      className={ui.input}
                    />
                    {hint && <span className="text-sm text-muted">{t("visits.quantityHint", { value: hint })}</span>}
                  </label>
                </li>
              );
            })}
          </ul>
          {picking ? (
            <PreparationPicker
              options={options}
              types={types}
              onClose={() => setPicking(false)}
              onPick={(preparationId) => {
                changeItems([...items, { key: crypto.randomUUID(), preparationId, manualName: null, manualTypeId: null, quantity: "" }]);
                setPicking(false);
              }}
              onManual={(name, typeId) => {
                changeItems([...items, { key: crypto.randomUUID(), preparationId: null, manualName: name, manualTypeId: typeId, quantity: "" }]);
                setPicking(false);
              }}
            />
          ) : (
            <button type="button" onClick={() => setPicking(true)} className={`${ui.addButton} self-start`}>
              {t("visits.addPreparation")}
            </button>
          )}
          {error("items")}
        </section>

        {/* LOT1: sticker photos for the whole visit. */}
        <section className={`${card.surface} flex flex-col gap-3 p-4`}>
          <h2 className={card.heading}>{t("visits.photos")}</h2>
          <PhotoField
            existing={initial.photos}
            removed={removedPhotos}
            added={newPhotos}
            onRemoveExisting={(id) => setRemovedPhotos([...removedPhotos, id])}
            onAdd={(photos) => setNewPhotos([...newPhotos, ...photos])}
            onRemoveNew={(key) => setNewPhotos(newPhotos.filter((p) => p.key !== key))}
          />
          {error("photos")}
        </section>

        {/* R2: internal notes. */}
        <section className={`${card.surface} flex flex-col gap-2 p-4`}>
          <label className="flex flex-col gap-2">
            <span className={card.heading}>{t("visits.notes")}</span>
            <span className="text-sm text-muted">{t("visits.notesHint")}</span>
            <textarea name="notes" rows={4} defaultValue={initial.notes} className={ui.input} />
          </label>
        </section>

        {/* P5 + AL1: advice from the catalogue, with the client's allergies and medications next to it. */}
        <section className={`${card.surface} flex flex-col gap-3 p-4`}>
          <h2 className={card.heading}>{t("visits.recommendations")}</h2>
          {alerts.length > 0 && (
            <div role="alert" className="flex gap-3 rounded-[14px] bg-alert p-3 text-on-alert">
              <WarningIcon className="mt-0.5 shrink-0" />
              <div className="flex flex-col gap-1 text-sm">
                {alerts.map((a) => (
                  <p key={a.field} className="whitespace-pre-wrap">
                    <span className="font-semibold">{t(`card.fields.${a.field}`)}:</span> {a.text}
                  </p>
                ))}
              </div>
            </div>
          )}
          <p className="text-sm text-muted">
            {t("visits.recommendationsHint", { language: t(`language.${language}`) })}
          </p>
          {askWith !== null && (
            <div className="flex flex-col gap-3 rounded-[14px] border border-field p-3">
              <p className="font-semibold text-ink">{t("visits.updateAsk")}</p>
              <p className="text-sm text-muted">{t("visits.updateAskHint")}</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setLastSuggested(askWith);
                    setAskWith(null);
                  }}
                  className="min-h-11 rounded-[14px] border border-field px-3 text-sm text-ink"
                >
                  {t("visits.updateNo")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRecommendations(askWith);
                    setLastSuggested(askWith);
                    setAskWith(null);
                  }}
                  className="min-h-11 rounded-[14px] bg-primary px-3 text-sm font-semibold text-on-primary"
                >
                  {t("visits.updateYes")}
                </button>
              </div>
            </div>
          )}
          <textarea
            name="recommendations"
            rows={8}
            value={recommendations}
            onChange={(e) => setRecommendations(e.target.value)}
            aria-label={t("visits.recommendations")}
            className={ui.input}
          />
        </section>

        {state.failed && <p className={ui.error}>{t("form.saveFailed")}</p>}
        <button type="submit" disabled={pending} className={ui.button}>
          {t("form.save")}
        </button>
      </form>

      {onDelete && <DeleteVisit onDelete={onDelete} />}
    </div>
  );
}

function DeleteVisit({ onDelete }: { onDelete: () => Promise<{ failed: true }> }) {
  const t = useTranslations("visits");
  const [confirming, setConfirming] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="inline-flex min-h-11 items-center justify-center text-base font-medium text-on-alert"
      >
        {t("delete")}
      </button>
    );
  }

  return (
    <div
      role="alertdialog"
      aria-label={t("delete")}
      className="flex flex-col gap-3 rounded-[18px] bg-alert p-4 text-on-alert"
    >
      <p>{t("confirmDelete")}</p>
      {failed && <p className="text-sm">{t("deleteFailed")}</p>}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="min-h-11 rounded-[14px] border border-current px-4"
        >
          {t("confirmNo")}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await onDelete();
              if (result?.failed) setFailed(true);
            })
          }
          className="min-h-11 rounded-[14px] bg-on-alert px-4 font-semibold text-alert disabled:opacity-50"
        >
          {t("confirmYes")}
        </button>
      </div>
    </div>
  );
}
