"use server";

import { cookies } from "next/headers";
import { localeCookie } from "@/config/locales";
import { isLocale } from "@/logic/locale";

export async function setLocale(locale: string) {
  if (!isLocale(locale)) return;
  (await cookies()).set(localeCookie, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}
