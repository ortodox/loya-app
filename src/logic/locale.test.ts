import { describe, expect, it } from "vitest";
import { isLocale, resolveLocale } from "./locale";

describe("resolveLocale", () => {
  it("defaults to Russian", () => {
    expect(resolveLocale(undefined)).toBe("ru");
    expect(resolveLocale("de")).toBe("ru");
  });

  it("keeps supported locales", () => {
    for (const l of ["ru", "uk", "pl", "en"]) expect(resolveLocale(l)).toBe(l);
  });

  it("rejects non-strings", () => {
    expect(isLocale(42)).toBe(false);
  });
});
