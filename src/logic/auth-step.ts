import { routes } from "@/config/routes";

export type AuthStep = "login" | "mfa" | "app";

export type AuthState = {
  hasUser: boolean;
  /** Current authenticator assurance level of the session (aal1 / aal2). */
  currentLevel: string | null;
};

/** TOTP is mandatory: only an aal2 session may use the app. */
export function authStep({ hasUser, currentLevel }: AuthState): AuthStep {
  if (!hasUser) return "login";
  if (currentLevel !== "aal2") return "mfa";
  return "app";
}

/** Where a request for `pathname` should be redirected, or null to let it through. */
export function redirectFor(pathname: string, state: AuthState): string | null {
  const step = authStep(state);
  const onLogin = pathname === routes.login;
  const onMfa = pathname === routes.mfa;

  if (step === "login") return onLogin ? null : routes.login;
  if (step === "mfa") return onMfa ? null : routes.mfa;
  return onLogin || onMfa || pathname === "/" ? routes.home : null;
}

export type MfaMode = "enroll" | "verify";

/** First login enrolls a TOTP factor; later logins verify against it. */
export function mfaMode(factors: { factor_type: string; status: string }[]): MfaMode {
  return factors.some((f) => f.factor_type === "totp" && f.status === "verified")
    ? "verify"
    : "enroll";
}
