export const locales = ["ru", "uk", "pl", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "ru";
export const localeCookie = "NEXT_LOCALE";
