"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SignOutButton } from "@/app/components/SignOutButton";
import { ui } from "@/app/components/ui";
import { routes } from "@/config/routes";
import { createClient } from "@/data/supabase/browser";
import { mfaMode, type MfaMode } from "@/logic/auth-step";

type Setup =
  | { mode: "verify"; factorId: string }
  | { mode: "enroll"; factorId: string; qrCode: string; secret: string };

async function prepare(): Promise<Setup> {
  const { mfa } = createClient().auth;
  const { data, error } = await mfa.listFactors();
  if (error) throw error;

  const mode: MfaMode = mfaMode(data.all);
  if (mode === "verify") return { mode, factorId: data.totp[0].id };

  // Drop half-finished enrollments so a new QR code can be issued.
  for (const f of data.all) {
    if (f.factor_type === "totp" && f.status === "unverified") {
      await mfa.unenroll({ factorId: f.id });
    }
  }
  const enrolled = await mfa.enroll({ factorType: "totp", friendlyName: "Loya" });
  if (enrolled.error) throw enrolled.error;
  return {
    mode,
    factorId: enrolled.data.id,
    qrCode: enrolled.data.totp.qr_code,
    secret: enrolled.data.totp.secret,
  };
}

export default function MfaPage() {
  const t = useTranslations();
  const router = useRouter();
  const [setup, setSetup] = useState<Setup | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    prepare()
      .then(setSetup)
      .catch(() => setError(t("common.error")));
  }, [t]);

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    if (!setup) return;
    setBusy(true);
    setError(null);
    const { error } = await createClient().auth.mfa.challengeAndVerify({
      factorId: setup.factorId,
      code: code.trim(),
    });
    setBusy(false);
    if (error) {
      setError(t("mfa.invalidCode"));
      return;
    }
    router.replace(routes.home);
    router.refresh();
  }

  return (
    <section className="flex flex-col gap-4 rounded-[18px] bg-surface p-5">
      {!setup ? (
        <p className={ui.muted}>{error ?? t("common.loading")}</p>
      ) : (
        <>
          <h1 className="font-serif text-3xl text-ink">
            {setup.mode === "enroll" ? t("mfa.enrollTitle") : t("mfa.verifyTitle")}
          </h1>
          <p className={ui.muted}>
            {setup.mode === "enroll" ? t("mfa.enrollIntro") : t("mfa.verifyIntro")}
          </p>

          {setup.mode === "enroll" && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- SVG data URL from Supabase */}
              <img
                src={setup.qrCode}
                alt=""
                width={200}
                height={200}
                className="mx-auto rounded-[14px] bg-white p-3"
              />
              <p className={ui.muted}>{t("mfa.secretLabel")}</p>
              <code className="select-all break-all rounded-[14px] border border-line bg-surface p-3 text-sm">
                {setup.secret}
              </code>
            </>
          )}

          <form onSubmit={confirm} className="flex flex-col gap-4">
            <label className="flex flex-col gap-2">
              <span className={ui.muted}>{t("mfa.codeLabel")}</span>
              <input
                required
                autoComplete="one-time-code"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className={`${ui.input} tracking-widest`}
              />
            </label>
            {error && <p className={ui.error}>{error}</p>}
            <button type="submit" disabled={busy} className={ui.button}>
              {t("mfa.confirm")}
            </button>
          </form>
        </>
      )}
      <div className="text-center">
        <SignOutButton />
      </div>
    </section>
  );
}
