"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useActionState } from "react";
import { card, ui } from "@/app/components/ui";
import type { ShopProductForm as FormValues } from "@/logic/usecases/shop";
import type { ShopProductState } from "./actions";

type Props = { title: string; initial: FormValues; brands: string[]; action: (s: ShopProductState, fd: FormData) => Promise<ShopProductState> };

/** MG1 «+ Товар» / «Изменить»: brand, category, name, size, price (Loya's own) and currency; ⭐ and hide. */
export function ShopProductForm({ title, initial, brands, action }: Props) {
  const t = useTranslations();
  const [state, formAction, pending] = useActionState(action, { values: initial });
  const v = state.values;
  const error = (field: keyof NonNullable<ShopProductState["errors"]>) =>
    state.errors?.[field] ? <p className={ui.error}>{t(`shop.errors.${field}`)}</p> : null;
  const field = (name: keyof FormValues, label: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="flex flex-col gap-2">
      <span className={card.label}>{label}</span>
      <input name={name} defaultValue={v[name]} className={ui.input} {...extra} />
    </label>
  );
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <header className="flex items-center justify-between gap-4">
        <Link href="/shop?view=catalog" className={ui.textButton}>
          {t("form.cancel")}
        </Link>
        <h1 className="text-center font-serif text-2xl text-ink">{title}</h1>
        <button type="submit" disabled={pending} className={`${ui.textButton} font-semibold disabled:opacity-50`}>
          {t("form.save")}
        </button>
      </header>
      <section className={`${card.surface} flex flex-col gap-4 p-4`}>
        {field("name", t("shop.name"), { required: true })}
        {error("name")}
        {field("brand", t("shop.brand"), { list: "shop-brands", required: true })}
        <datalist id="shop-brands">
          {brands.map((b) => (
            <option key={b} value={b} />
          ))}
        </datalist>
        {error("brand")}
        {field("category", t("shop.category"))}
        {field("size", t("shop.size"))}
        <div className="flex gap-2">
          <label className="flex flex-1 flex-col gap-2">
            <span className={card.label}>{t("shop.price")}</span>
            <input name="price" inputMode="decimal" defaultValue={v.price} className={ui.input} />
          </label>
          <label className="flex w-28 flex-col gap-2">
            <span className={card.label}>{t("shop.currency")}</span>
            <select name="currency" defaultValue={v.currency || "PLN"} className={ui.input}>
              <option value="PLN">zł (PLN)</option>
              <option value="EUR">€ (EUR)</option>
            </select>
          </label>
        </div>
        {error("price")}
        {error("currency")}
        <label className="flex min-h-11 items-center gap-3 text-base text-ink">
          <input type="checkbox" name="favorite" defaultChecked={v.favorite === "on"} className="size-5 accent-[var(--accent)]" />
          ⭐ {t("shop.favorite")}
        </label>
        <label className="flex min-h-11 items-center gap-3 text-base text-ink">
          <input type="checkbox" name="hidden" defaultChecked={v.hidden === "on"} className="size-5 accent-[var(--accent)]" />
          {t("shop.hide")}
        </label>
        {state.failed && <p className={ui.error}>{t("shop.failed")}</p>}
      </section>
      <button type="submit" disabled={pending} className={ui.button}>
        {t("form.save")}
      </button>
    </form>
  );
}
