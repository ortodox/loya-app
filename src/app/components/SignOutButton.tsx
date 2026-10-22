"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { routes } from "@/config/routes";
import { createClient } from "@/data/supabase/browser";
import { ui } from "./ui";

export function SignOutButton() {
  const t = useTranslations("common");
  const router = useRouter();

  return (
    <button
      type="button"
      className={ui.link}
      onClick={async () => {
        await createClient().auth.signOut();
        router.replace(routes.login);
        router.refresh();
      }}
    >
      {t("signOut")}
    </button>
  );
}
