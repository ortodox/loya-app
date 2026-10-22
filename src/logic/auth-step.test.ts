import { describe, expect, it } from "vitest";
import { authStep, mfaMode, redirectFor } from "./auth-step";

const anon = { hasUser: false, currentLevel: null };
const aal1 = { hasUser: true, currentLevel: "aal1" };
const aal2 = { hasUser: true, currentLevel: "aal2" };

describe("authStep", () => {
  it("requires login, then TOTP", () => {
    expect(authStep(anon)).toBe("login");
    expect(authStep(aal1)).toBe("mfa");
    expect(authStep(aal2)).toBe("app");
  });
});

describe("redirectFor", () => {
  it("sends anonymous users to login", () => {
    expect(redirectFor("/clients", anon)).toBe("/login");
    expect(redirectFor("/mfa", anon)).toBe("/login");
    expect(redirectFor("/login", anon)).toBeNull();
  });

  it("keeps aal1 sessions on the TOTP step", () => {
    expect(redirectFor("/clients", aal1)).toBe("/mfa");
    expect(redirectFor("/login", aal1)).toBe("/mfa");
    expect(redirectFor("/mfa", aal1)).toBeNull();
  });

  it("lets aal2 sessions into the app", () => {
    expect(redirectFor("/clients", aal2)).toBeNull();
    expect(redirectFor("/", aal2)).toBe("/clients");
    expect(redirectFor("/login", aal2)).toBe("/clients");
    expect(redirectFor("/mfa", aal2)).toBe("/clients");
  });
});

describe("mfaMode", () => {
  it("enrolls when no verified TOTP factor exists", () => {
    expect(mfaMode([])).toBe("enroll");
    expect(mfaMode([{ factor_type: "totp", status: "unverified" }])).toBe("enroll");
  });

  it("verifies when a TOTP factor is verified", () => {
    expect(mfaMode([{ factor_type: "totp", status: "verified" }])).toBe("verify");
  });
});
