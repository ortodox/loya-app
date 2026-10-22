import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { ui } from "@/app/components/ui";

export default async function ClientNotFound() {
  const t = await getTranslations("card");
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-5 py-6">
      <p className={ui.muted}>{t("notFound")}</p>
      <Link href="/clients" className={ui.link}>
        ‹ {t("back")}
      </Link>
    </main>
  );
}
