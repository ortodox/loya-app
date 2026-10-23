// Shared Tailwind classes for the LOA look (tokens in globals.css).
// Every tap target is at least 44 px high; 16 px inputs stop iOS Safari from zooming on focus.
export const ui = {
  input:
    "min-h-11 w-full rounded-[14px] border border-field bg-surface px-4 py-3 text-base text-ink placeholder:text-muted outline-none focus:border-accent",
  button:
    "flex min-h-11 w-full items-center justify-center rounded-[14px] bg-primary px-4 py-3 text-base font-semibold text-on-primary disabled:opacity-50",
  /** Text-only tap target (links in headers, sign out, cancel). */
  textButton: "inline-flex min-h-11 items-center text-base font-medium text-accent",
  link: "inline-flex min-h-11 items-center text-sm text-accent underline",
  error: "text-sm font-medium text-on-alert",
  muted: "text-sm text-muted",
  /** Round 44×44 button, e.g. «+». */
  roundButton:
    "flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-2xl leading-none text-on-primary",
  /** Small outlined label, e.g. country code. */
  tag: "inline-flex items-center rounded-full border border-field px-2 py-0.5 text-xs font-semibold tracking-wide text-muted",
  alertTag: "inline-flex items-center rounded-full bg-alert px-2 py-0.5 text-xs font-semibold text-on-alert",
} as const;

export const card = {
  /** Rounded surface for a section of the card or the list. */
  surface: "rounded-[18px] bg-surface",
  heading: "font-serif text-2xl leading-tight text-ink",
  label: "text-sm text-muted",
  row: "flex flex-col gap-0.5 border-b border-line px-4 py-3 last:border-b-0",
} as const;

/** Quick-choice pill; selected = dark filled. */
export const pill = {
  base: "inline-flex min-h-11 items-center gap-1 rounded-full border px-4 text-sm",
  on: "border-primary bg-primary text-on-primary",
  off: "border-field text-ink",
} as const;

/** Collapsible row (<details>/<summary>) with a chevron, used for clinical sections. */
export const disclosure = {
  summary:
    "flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden",
  chevron: "shrink-0 text-muted transition-transform group-open:rotate-180",
} as const;

/** Form sections: a rounded card whose header opens and closes it. */
export const formSection = {
  card: "group rounded-[18px] bg-surface",
  summary: `${disclosure.summary} font-serif text-2xl text-ink`,
  body: "flex flex-col gap-5 border-t border-line px-4 pt-4 pb-5",
} as const;
