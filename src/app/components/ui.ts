// Shared Tailwind classes. 16px inputs stop iOS Safari from zooming on focus.
export const ui = {
  input:
    "w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-base text-neutral-900 outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100",
  button:
    "w-full rounded-xl bg-neutral-900 px-4 py-3 text-base font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900",
  link: "text-sm text-neutral-500 underline dark:text-neutral-400",
  error: "text-sm text-red-600 dark:text-red-400",
  muted: "text-sm text-neutral-600 dark:text-neutral-400",
} as const;

export const card = {
  label: "text-sm text-neutral-500 dark:text-neutral-400",
  section: "rounded-2xl bg-neutral-100 dark:bg-neutral-900",
  row: "flex flex-col gap-0.5 px-4 py-3 border-b border-neutral-200 last:border-b-0 dark:border-neutral-800",
} as const;
