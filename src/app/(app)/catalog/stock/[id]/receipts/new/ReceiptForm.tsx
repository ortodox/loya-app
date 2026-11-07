"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useActionState, useState } from "react";
import { card, pill, ui } from "@/app/components/ui";
import type { ReceiptState } from "../../../actions";

type Props = { name: string; vialSizes: number[] | null; today: string; action: (s: ReceiptState, fd: FormData) => Promise<ReceiptState> };

/** SK1 «+ Поступление»: botox – size and number of vials, or one already opened vial; others – pieces. */
export function ReceiptForm({ name, vialSizes, today, action }: Props) {
  const t = useTranslations();
  const [state, formAction, pending] = useActionState(action, { values: { receivedOn: today, vialSize: vialSizes?.length === 1 ? String(vialSizes[0]) : "", count: "1" } });
  const v = state.values;
  const [size, setSize] = useState(v.vialSize ?? "");
  const [opened, setOpened] = useState(v.opened === "1");
  // SK1 ✏️ B: «Другой размер» – a size the preparation does not have yet; it is added when saved.
  const [newSize, setNewSize] = useState(v.newSize ?? "");
  const error = (field: keyof NonNullable<ReceiptState["errors"]>) =>
    state.errors?.[field] ? <p className={ui.error}>{t(`stock.errors.${field}`)}</p> : null;
  const vials = vialSizes !== null;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <header className="flex items-center justify-between gap-4">
        <Link href="/catalog?view=stock" className={ui.textButton}>
          {t("form.cancel")}
        </Link>
        <h1 className="text-center font-serif text-2xl text-ink">{t("stock.receiveTitle")}</h1>
        <button type="submit" disabled={pending} className={`${ui.textButton} font-semibold disabled:opacity-50`}>
          {t("form.save")}
        </button>
      </header>
      <section className={`${card.surface} flex flex-col gap-4 p-4`}>
        <h2 className={card.heading}>{name}</h2>
        <label className="flex flex-col gap-2">
          <span className={card.label}>{t("stock.receivedOn")}</span>
          <input name="receivedOn" type="date" max={today} defaultValue={v.receivedOn} className={ui.input} />
        </label>
        {error("receivedOn")}

        {vials && (
          <div className="flex flex-col gap-2">
            <span className={card.label}>{t("stock.vialSize")}</span>
            <div className="flex flex-wrap gap-2">
              {vialSizes.map((s) => (
                <label key={s} className={`${pill.base} ${size === String(s) && !newSize ? pill.on : pill.off}`}>
                  <input type="radio" name="vialSize" value={s} checked={size === String(s)} onChange={() => { setSize(String(s)); setNewSize(""); }} className="sr-only" />
                  {size === String(s) && !newSize && "✓ "}
                  {s} {t("stock.units")}
                </label>
              ))}
            </div>
            <label className="flex flex-col gap-2">
              <span className={card.label}>{t("stock.ownSize")}</span>
              <input name="newSize" inputMode="numeric" value={newSize} onChange={(e) => setNewSize(e.target.value)} className={ui.input} />
            </label>
            {error("vialSize")}
          </div>
        )}

        {vials && (
          <label className="flex min-h-11 items-center gap-3 text-base text-ink">
            <input type="checkbox" name="opened" value="1" checked={opened} onChange={(e) => setOpened(e.target.checked)} className="size-5 accent-[var(--accent)]" />
            {t("stock.alreadyOpen")}
          </label>
        )}

        {opened ? (
          <>
            <label className="flex flex-col gap-2">
              <span className={card.label}>{t("stock.openedOn")}</span>
              <input name="openedOn" type="date" max={today} defaultValue={v.openedOn ?? today} className={ui.input} />
            </label>
            {error("openedOn")}
            <label className="flex flex-col gap-2">
              <span className={card.label}>{t("stock.remaining")}</span>
              <input name="remaining" inputMode="decimal" defaultValue={v.remaining} className={ui.input} />
            </label>
            {error("remaining")}
          </>
        ) : (
          <>
            <label className="flex flex-col gap-2">
              <span className={card.label}>{t(vials ? "stock.countVials" : "stock.countPieces")}</span>
              <input name="count" inputMode="numeric" defaultValue={v.count} className={ui.input} />
            </label>
            {error("count")}
          </>
        )}

        <details className="group">
          <summary className="flex min-h-11 cursor-pointer list-none items-center text-base text-accent [&::-webkit-details-marker]:hidden">
            {t("stock.more")}
          </summary>
          <div className="flex flex-col gap-4 pt-2">
            <label className="flex flex-col gap-2">
              <span className={card.label}>{t("stock.lot")}</span>
              <input name="lot" defaultValue={v.lot} className={ui.input} />
            </label>
            <label className="flex flex-col gap-2">
              <span className={card.label}>{t("stock.expiresOn")}</span>
              <input name="expiresOn" type="date" defaultValue={v.expiresOn} className={ui.input} />
            </label>
            {error("expiresOn")}
          </div>
        </details>
        {state.failed && <p className={ui.error}>{t("stock.failed")}</p>}
      </section>
      <button type="submit" disabled={pending} className={ui.button}>
        {t("form.save")}
      </button>
    </form>
  );
}
