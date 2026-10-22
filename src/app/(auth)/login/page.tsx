"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ui } from "@/app/components/ui";
import { routes } from "@/config/routes";
import { createClient } from "@/data/supabase/browser";

export default function LoginPage() {
  const t = useTranslations("login");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    // shouldCreateUser: false – only the doctor's pre-created account can sign in.
    const { error } = await createClient().auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });
    setBusy(false);
    if (error) setError(t("sendFailed"));
    else setCodeSent(true);
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await createClient().auth.verifyOtp({
      email,
      token: code.trim(),
      type: "email",
    });
    setBusy(false);
    if (error) {
      setError(t("invalidCode"));
      return;
    }
    router.replace(routes.mfa);
    router.refresh();
  }

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>

      {!codeSent ? (
        <form onSubmit={sendCode} className="flex flex-col gap-4">
          <label className="flex flex-col gap-2">
            <span className={ui.muted}>{t("emailLabel")}</span>
            <input
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              placeholder={t("emailPlaceholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={ui.input}
            />
          </label>
          {error && <p className={ui.error}>{error}</p>}
          <button type="submit" disabled={busy} className={ui.button}>
            {t("sendCode")}
          </button>
        </form>
      ) : (
        <form onSubmit={verifyCode} className="flex flex-col gap-4">
          <p className={ui.muted}>{t("codeSent", { email })}</p>
          <label className="flex flex-col gap-2">
            <span className={ui.muted}>{t("codeLabel")}</span>
            <input
              required
              autoComplete="one-time-code"
              inputMode="numeric"
              pattern="[0-9]{6,10}"
              maxLength={10}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className={`${ui.input} tracking-widest`}
            />
          </label>
          {error && <p className={ui.error}>{error}</p>}
          <button type="submit" disabled={busy} className={ui.button}>
            {t("verify")}
          </button>
          <button
            type="button"
            className={ui.link}
            onClick={() => {
              setCodeSent(false);
              setCode("");
              setError(null);
            }}
          >
            {t("changeEmail")}
          </button>
        </form>
      )}
    </section>
  );
}
