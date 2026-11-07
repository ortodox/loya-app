"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useActionState, useState } from "react";
import { card, pill, ui } from "@/app/components/ui";

type Props = {
  name: string;
  pieces: number | null;
  /** «В наличии» before the correction. */
  available: number;
  vialSizes: number[];
  openVials: { key: string; size: number; remaining: number; openedOn: string }[];
  closed: { size: number; count: number }[];
  action: (s: { failed?: boolean; invalid?: boolean }, fd: FormData) => Promise<{ failed?: boolean; invalid?: boolean }>;
};

const show = (n: number) => String(Math.round(n * 10) / 10).replace(".", ",");
const read = (v: string) => (v.trim() === "" ? null : Number(v.trim().replace(",", ".")));

/**
 * SK1 «Исправить остаток»: pieces, or per open vial what is left (0 = thrown away) and how many closed
 * vials of each size. SK1 ✏️ A: every field says whether it is units or vials, and the total in ЕД is
 * worked out while typing – so 20 units are never entered as 20 vials by mistake.
 */
export function CorrectForm({ name, pieces, available, vialSizes, openVials, closed, action }: Props) {
  const t = useTranslations();
  const [state, formAction, pending] = useActionState(action, {});
  const [open, setOpen] = useState<Record<string, string>>(Object.fromEntries(openVials.map((v) => [v.key, show(v.remaining)])));
  const [counts, setCounts] = useState<Record<number, string>>(Object.fromEntries(closed.map((c) => [c.size, String(c.count)])));
  const [newSize, setNewSize] = useState(String(vialSizes[0] ?? ""));
  const [newRemaining, setNewRemaining] = useState("");

  const openTotal = openVials.reduce((sum, v) => sum + (read(open[v.key] ?? "") ?? v.remaining), 0) + (read(newRemaining) ?? 0);
  const closedTotal = closed.reduce((sum, c) => sum + (read(counts[c.size] ?? "") ?? c.count) * c.size, 0);
  const total = openTotal + closedTotal;
  const units = t("stock.units");

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
            <h3 className="text-base font-semibold text-ink">{t("stock.openSection")}</h3>
            {openVials.map((v) => (
              <label key={v.key} className="flex flex-col gap-2">
                <span className={card.label}>{t("stock.openVialField", { date: v.openedOn, size: v.size })}</span>
                <div className="flex items-center gap-2">
                  <input name={`open.${v.key}`} inputMode="decimal" value={open[v.key] ?? ""} onChange={(e) => setOpen({ ...open, [v.key]: e.target.value })} className={ui.input} />
                  <span className="shrink-0 text-base text-muted">{units}</span>
                </div>
              </label>
            ))}
            {openVials.length === 0 && (
              <div className="flex flex-col gap-2">
                <span className={card.label}>{t("stock.openNewField")}</span>
                {vialSizes.length > 1 && (
                  <div className="flex flex-wrap gap-2">
                    {vialSizes.map((s) => (
                      <label key={s} className={`${pill.base} ${newSize === String(s) ? pill.on : pill.off}`}>
                        <input type="radio" name="openNew.size" value={s} checked={newSize === String(s)} onChange={() => setNewSize(String(s))} className="sr-only" />
                        {newSize === String(s) && "✓ "}
                        {t("stock.vialOf", { size: s })}
                      </label>
                    ))}
                  </div>
                )}
                {vialSizes.length === 1 && <input type="hidden" name="openNew.size" value={vialSizes[0]} />}
                <div className="flex items-center gap-2">
                  <input name="openNew.remaining" inputMode="decimal" value={newRemaining} onChange={(e) => setNewRemaining(e.target.value)} placeholder="0" className={ui.input} />
                  <span className="shrink-0 text-base text-muted">{units}</span>
                </div>
              </div>
            )}

            <h3 className="pt-2 text-base font-semibold text-ink">{t("stock.closedSection")}</h3>
            {closed.map((c) => {
              const now = read(counts[c.size] ?? "") ?? c.count;
              const diff = now - c.count;
              return (
                <label key={c.size} className="flex flex-col gap-2">
                  <span className={card.label}>{t("stock.closedField", { size: c.size })}</span>
                  <div className="flex items-center gap-2">
                    <input name={`closed.${c.size}`} inputMode="numeric" value={counts[c.size] ?? ""} onChange={(e) => setCounts({ ...counts, [c.size]: e.target.value })} className={ui.input} />
                    <span className="shrink-0 text-base text-muted">{t("stock.vialsShort")}</span>
                  </div>
                  <span className={`text-sm ${diff !== 0 ? "font-semibold text-on-alert" : "text-muted"}`}>
                    {diff !== 0
                      ? t("stock.closedChange", { from: c.count, to: now, units: `${diff > 0 ? "+" : "−"}${show(Math.abs(diff * c.size))}` })
                      : t("stock.closedTotal", { count: now, size: c.size, units: show(now * c.size) })}
                  </span>
                </label>
              );
            })}
            <p className="rounded-[14px] border border-line px-4 py-3 text-base text-ink">
              {t("stock.totalAfter", { total: show(total), before: show(available) })}
            </p>
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
