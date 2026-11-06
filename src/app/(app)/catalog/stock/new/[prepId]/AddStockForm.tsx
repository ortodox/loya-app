"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useActionState, useState } from "react";
import { card, pill, ui } from "@/app/components/ui";
import type { AddStockState } from "../../actions";

const commonSizes = [50, 100, 200, 300, 500];

/** SK1: botox – which vial sizes this preparation comes in (each its own); the rest – pieces. */
export function AddStockForm({ title, name, botox, action }: { title: string; name: string; botox: boolean; action: (s: AddStockState, fd: FormData) => Promise<AddStockState> }) {
  const t = useTranslations();
  const [state, formAction, pending] = useActionState(action, {});
  const [sizes, setSizes] = useState<number[]>([]);
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <header className="flex items-center justify-between gap-4">
        <Link href="/catalog/stock/new" className={ui.textButton}>
          {t("form.cancel")}
        </Link>
        <h1 className="text-center font-serif text-2xl text-ink">{title}</h1>
        <button type="submit" disabled={pending} className={`${ui.textButton} font-semibold disabled:opacity-50`}>
          {t("form.save")}
        </button>
      </header>
      <section className={`${card.surface} flex flex-col gap-4 p-4`}>
        <h2 className={card.heading}>{name}</h2>
        {botox ? (
          <>
            <p className={ui.muted}>{t("stock.sizesIntro")}</p>
            <div className="flex flex-wrap gap-2">
              {commonSizes.map((size) => {
                const on = sizes.includes(size);
                return (
                  <label key={size} className={`${pill.base} ${on ? pill.on : pill.off}`}>
                    <input
                      type="checkbox"
                      name="size"
                      value={size}
                      checked={on}
                      onChange={() => setSizes(on ? sizes.filter((s) => s !== size) : [...sizes, size])}
                      className="sr-only"
                    />
                    {on && "✓ "}
                    {size} {t("stock.units")}
                  </label>
                );
              })}
            </div>
            <label className="flex flex-col gap-2">
              <span className={card.label}>{t("stock.ownSize")}</span>
              <input name="ownSize" inputMode="numeric" className={ui.input} />
            </label>
          </>
        ) : (
          <p className="text-base text-ink">{t("stock.piecesIntro")}</p>
        )}
        <p className={ui.muted}>{t("stock.startsToday")}</p>
        {state.error && <p className={ui.error}>{t(`stock.errors.${state.error}`)}</p>}
      </section>
      <button type="submit" disabled={pending} className={ui.button}>
        {t("stock.addAndReceive")}
      </button>
    </form>
  );
}
