import { redirect } from "next/navigation";
import { createClient } from "@/data/supabase/server";
import { getAuthState } from "@/data/supabase/session";
import { redirectFor } from "@/logic/auth-step";
import { routes } from "@/config/routes";
import { TabBar } from "@/app/components/TabBar";
import { practiceTimeZone } from "@/config/time";
import { clientRepository } from "@/data/repositories/server";
import { todayIn } from "@/logic/rules/dates";
import { countToday } from "@/logic/usecases/clients";

// Second line of defence after the proxy: never render app pages without aal2.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const target = redirectFor(routes.home, await getAuthState(await createClient()));
  if (target) redirect(target);
  // TD1: «Сегодня ③» – never stops a page from opening.
  const waiting = await countToday(await clientRepository(), todayIn(practiceTimeZone)).catch(() => 0);
  return (
    <>
      {children}
      <TabBar badges={{ today: waiting }} />
    </>
  );
}
