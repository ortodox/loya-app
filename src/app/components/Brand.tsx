import { getTranslations } from "next-intl/server";

/** Four-pointed star from the LOA mark. */
function Star({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor">
      <path d="M12 0 13.6 10.4 24 12 13.6 13.6 12 24 10.4 13.6 0 12 10.4 10.4Z" />
    </svg>
  );
}

/** Large LOA mark for the sign-in screens. */
export async function BrandHero() {
  const t = await getTranslations("brand");
  return (
    <div className="flex flex-col items-center gap-2 text-center" aria-label={`${t("name")} – ${t("subtitle")}`}>
      <Star className="size-3.5 text-gold" />
      <p className="font-serif text-7xl leading-none tracking-[0.12em] text-gold">{t("name")}</p>
      <svg viewBox="0 0 120 12" aria-hidden className="-mt-1 h-3 w-28 text-gold" fill="none">
        <path d="M2 2 Q60 14 118 2" stroke="currentColor" strokeWidth="1" />
      </svg>
      <p className="text-xs font-medium tracking-[0.42em] text-muted">{t("subtitle")}</p>
      <div className="flex w-48 items-center gap-3 text-gold" aria-hidden>
        <span className="h-px flex-1 bg-field" />
        <Star className="size-2.5" />
        <span className="h-px flex-1 bg-field" />
      </div>
      <p className="text-[0.65rem] font-medium tracking-[0.28em] text-muted">{t("motto")}</p>
    </div>
  );
}

/** Small LOA mark for page headers. */
export async function BrandMark() {
  const t = await getTranslations("brand");
  return (
    <span className="inline-flex items-start gap-1 font-serif text-2xl leading-none tracking-[0.12em] text-gold">
      {t("name")}
      <Star className="size-2" />
    </span>
  );
}
