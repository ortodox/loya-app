"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useActionState } from "react";
import { card, ui } from "@/app/components/ui";

type Props = {
  name: string;
  pieces: number | null;
  openVials: { key: string; size: number; remaining: number; openedOn: string }[];
  closed: { size: number; count: number }[];
  action: (s: { failed?: boolean; invalid?: boolean }, fd: FormData) => Promise<{ failed?: boolean; invalid?: boolean }>;
};

const show = (n: number) => String(Math.round(n * 10) / 10);

/** SK1 «Исправить остаток»: pieces, or per open vial what is left (0 = thrown away) and closed vials per size. */
export function CorrectForm({ name, pieces, openVials, closed, action }: Props) {
  const t = useTranslations();
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <header className="flex items-center justify-between gap-4">
        <Link href="/catalog?view=stock" className={ui.textButton}>
          {t("form.cancel")}
        </Link>
        <h1 className="text-center font-serif text-2xl text-ink">{t("stock.correctTitle")}</h1>
        <button type="submit" disabled={pending} className={`${ui.textButton} font-semibold disabled:opacity-50`}>
          {t("form.save")}
        </button>
      </header>
      <section className={`${card.surface} flex flex-col gap-4 p-4`}>
        <h2 className={card.heading}>{name}</h2>
        <p className={ui.muted}>{t("stock.correctIntro")}</p>
        {pieces !== null ? (
          <label className="flex flex-col gap-2">
            <span className={card.label}>{t("stock.countPieces")}</span>
            <input name="pieces" inputMode="numeric" defaultValue={pieces} className={ui.input} />
          </label>
        ) : (
          <>
            {openVials.map((v) => (
              <label key={v.key} className="flex flex-col gap-2">
                <span className={card.label}>{t("stock.openVialField", { date: v.openedOn, size: v.size })}</span>
                <input name={`open.${v.key}`} inputMode="decimal" defaultValue={show(v.remaining)} className={ui.input} />
              </label>
            ))}
            {closed.map((c) => (
              <label key={c.size} className="flex flex-col gap-2">
                <span className={card.label}>{t("stock.closedField", { size: c.size })}</span>
                <input name={`closed.${c.size}`} inputMode="numeric" defaultValue={c.count} className={ui.input} />
              </label>
            ))}
          </>
        )}
        {state.invalid && <p className={ui.error}>{t("stock.errors.invalid")}</p>}
        {state.failed && <p className={ui.error}>{t("stock.failed")}</p>}
      </section>
      <button type="submit" disabled={pending} className={ui.button}>
        {t("form.save")}
      </button>
    </form>
  );
}
