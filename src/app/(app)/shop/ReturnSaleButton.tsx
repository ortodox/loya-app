"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { ui } from "@/app/components/ui";
import { returnSaleAction } from "./actions";

/** MG13 «Исправить» → «Вернуть 1 шт на склад?» «Да» / «Нет». */
export function ReturnSaleButton({ productId, month, currency, name }: { productId: string; month: string; currency: string; name: string }) {
  const t = useTranslations("shop");
  const [asking, setAsking] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <>
      <button type="button" onClick={() => { setFailed(false); setAsking(true); }} className={`${ui.textButton} self-start text-sm`}>
        {t("fix")}
      </button>
      {asking && (
        <div role="alertdialog" aria-label={t("fix")} className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-w-2xl flex-col gap-3 rounded-t-[18px] border-t border-line bg-surface p-4 pb-[calc(1rem+var(--safe-bottom))] text-ink shadow-lg">
          <p className="text-base">
            <span className="font-semibold">{t("returnQuestion")}</span>
            <br />
            <span className="text-muted">{name}</span>
          </p>
          {failed && <p className={ui.error}>{t("failed")}</p>}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setAsking(false)} className="min-h-11 rounded-[14px] border border-field px-3 text-base text-ink">
              {t("no")}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const { ok } = await returnSaleAction(productId, month, currency);
                  if (ok) setAsking(false);
                  else setFailed(true);
                })
              }
              className={ui.button}
            >
              {t("yes")}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
