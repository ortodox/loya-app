import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { localeCookie } from "@/config/locales";
import { practiceTimeZone } from "@/config/time";
import { resolveLocale } from "@/logic/locale";

export default getRequestConfig(async () => {
  const locale = resolveLocale((await cookies()).get(localeCookie)?.value);
  return {
    locale,
    timeZone: practiceTimeZone,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
