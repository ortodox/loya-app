import { describe, expect, it } from "vitest";
import { allCountries } from "@/config/countries";
import { countryName, countryOptions, flagEmoji, isCountryCode } from "./country";

describe("PR5: country of residence", () => {
  it("PR5: shows a flag for an ISO code", () => {
    expect(flagEmoji("PL")).toBe("🇵🇱");
    expect(flagEmoji("UA")).toBe("🇺🇦");
    expect(flagEmoji("XX")).toBe("");
  });

  it("PR5: shows the country name in the UI language", () => {
    expect(countryName("PL", "ru")).toBe("Польша");
    expect(countryName("PL", "uk")).toBe("Польща");
    expect(countryName("PL", "pl")).toBe("Polska");
    expect(countryName("NO", "en")).toBe("Norway");
  });

  it("PR1: lists Польша, Украина, Беларусь, Германия, Норвегия first", () => {
    const { common, other } = countryOptions("ru");
    expect(common.map((c) => c.name)).toEqual(["Польша", "Украина", "Беларусь", "Германия", "Норвегия"]);
    expect(other.some((c) => c.code === "PL")).toBe(false);
    expect(other.length + common.length).toBe(allCountries.length);
    const names = other.map((c) => c.name);
    expect(names).toEqual([...names].sort(new Intl.Collator("ru").compare));
  });

  it("PR1: accepts only ISO 3166-1 alpha-2 codes", () => {
    expect(allCountries).toHaveLength(249);
    expect(new Set(allCountries).size).toBe(249);
    expect(isCountryCode("DE")).toBe(true);
    expect(isCountryCode("de")).toBe(false);
    expect(isCountryCode("Poland")).toBe(false);
  });
});
