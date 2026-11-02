"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { completeRemindersAction } from "./visits/actions";

/** N7: «Готово» – the reminder is done and «⏰ Пора» goes away. No question asked. */
export function ReminderDone({ clientId }: { clientId: string }) {
  const t = useTranslations("reminders");
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const { ok } = await completeRemindersAction(clientId);
            setFailed(!ok);
          })
        }
        className="inline-flex min-h-11 items-center rounded-full bg-primary px-4 text-sm font-semibold text-on-primary disabled:opacity-50"
      >
        {t("done")}
      </button>
      {failed && <span className="text-xs text-on-alert">{t("doneFailed")}</span>}
    </div>
  );
}
