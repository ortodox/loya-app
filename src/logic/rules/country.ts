import { allCountries, commonCountries } from "@/config/countries";

const known = new Set<string>(allCountries);

export function isCountryCode(value: unknown): value is string {
  return typeof value === "string" && known.has(value);
}

/** PR5: flag emoji from an ISO 3166-1 alpha-2 code (regional indicator symbols). */
export function flagEmoji(code: string): string {
  if (!isCountryCode(code)) return "";
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

/** PR5: country name in the UI language. */
export function countryName(code: string, locale: string): string {
  return new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? code;
}

export type CountryOption = { code: string; name: string; flag: string };

/** PR1: the most common countries first, then all others alphabetically in the UI language. */
export function countryOptions(locale: string): { common: CountryOption[]; other: CountryOption[] } {
  const option = (code: string) => ({ code, name: countryName(code, locale), flag: flagEmoji(code) });
  const common = new Set<string>(commonCountries);
  const collator = new Intl.Collator(locale);
  return {
    common: commonCountries.map(option),
    other: allCountries
      .filter((c) => !common.has(c))
      .map(option)
      .sort((a, b) => collator.compare(a.name, b.name)),
  };
}
