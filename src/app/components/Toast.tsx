"use client";

import { useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

type Show = (message: string, undo?: () => Promise<unknown> | void) => void;
const ToastContext = createContext<Show>(() => {});

/** UX3/UX8: one message at the bottom for 5 seconds – «Продано · Отменить», «Сохранено ✓». */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const t = useTranslations("toast");
  const [toast, setToast] = useState<{ id: number; message: string; undo?: () => Promise<unknown> | void } | null>(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback<Show>((message, undo) => {
    if (timer.current) clearTimeout(timer.current);
    const id = Date.now();
    setToast({ id, message, undo });
    timer.current = setTimeout(() => setToast((cur) => (cur?.id === id ? null : cur)), 5000);
  }, []);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-x-0 z-40 mx-auto flex max-w-2xl px-4"
          style={{ bottom: "calc(var(--safe-bottom) + 5.5rem)" }}
        >
          <div className="flex min-h-12 w-full items-center justify-between gap-3 rounded-[14px] bg-primary px-4 py-2 text-on-primary shadow-lg">
            <span className="text-base font-semibold">{toast.message}</span>
            {toast.undo && (
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await toast.undo?.();
                  } finally {
                    setBusy(false);
                    setToast(null);
                  }
                }}
                className="inline-flex min-h-11 shrink-0 items-center rounded-full border border-current px-4 text-sm font-semibold disabled:opacity-50"
              >
                {t("undo")}
              </button>
            )}
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

/** UX8: a page reached after «Сохранить» (`?saved=1`) says «Сохранено ✓» and drops the mark from the address. */
export function SavedToast() {
  const t = useTranslations("toast");
  const show = useToast();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (params.get("saved") !== "1") return;
    show(t("saved"));
    const rest = new URLSearchParams(params.toString());
    rest.delete("saved");
    const query = rest.toString();
    router.replace(`${pathname}${query ? `?${query}` : ""}${window.location.hash}`, { scroll: false });
  }, [params, pathname, router, show, t]);
  return null;
}
