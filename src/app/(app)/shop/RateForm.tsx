"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { card, ui } from "@/app/components/ui";
import { formatIsoDate } from "@/logic/rules/dates";
import { setOwnRateAction } from "./order-actions";

/** MG9 «Курс €»: the NBP selling rate (by itself), or Loya's own rate until «По NBP». */
export function RateForm({ own, nbp, locale }: { own: number | null; nbp: { rate: number; date: string } | null; locale: string }) {
  const t = useTranslations("shop.orders");
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(own ? String(own).replace(".", ",") : "");
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();
  const num = (v: number) => new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(v);
  const save = (input: string) =>
    startTransition(async () => {
      const { ok } = await setOwnRateAction(input);
      setFailed(!ok);
      if (ok) setEditing(false);
    });

  return (
    <section className={`${card.surface} flex flex-col gap-2 px-4 py-3`}>
      <p className="text-sm text-ink">
        {own ? t("rateOwn", { rate: num(own) }) : nbp ? t("rateNbp", { rate: num(nbp.rate), date: formatIsoDate(nbp.date) }) : t("rateUnknown")}
      </p>
      {own && nbp && <p className={ui.muted}>{t("rateNbp", { rate: num(nbp.rate), date: formatIsoDate(nbp.date) })}</p>}
      {editing ? (
        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-1">
            <span className={card.label}>{t("ownRateLabel")}</span>
            <input value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" placeholder="4,30" className={ui.input} />
          </label>
          {failed && <p className={ui.error}>{t("rateInvalid")}</p>}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setEditing(false)} className="min-h-11 rounded-[14px] border border-field px-3 text-base text-ink">
              {t("cancel")}
            </button>
            <button type="button" disabled={pending} onClick={() => save(value)} className={ui.button}>
              {t("save")}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-4">
          <button type="button" onClick={() => setEditing(true)} className={`${ui.textButton} text-sm`}>
            {t("ownRate")}
          </button>
          {own && (
            <button type="button" disabled={pending} onClick={() => save("")} className={`${ui.textButton} text-sm`}>
              {t("useNbp")}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
