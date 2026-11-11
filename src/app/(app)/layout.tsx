import { redirect } from "next/navigation";
import { createClient } from "@/data/supabase/server";
import { getAuthState } from "@/data/supabase/session";
import { redirectFor } from "@/logic/auth-step";
import { routes } from "@/config/routes";
import { Suspense } from "react";
import { TabBar } from "@/app/components/TabBar";
import { SavedToast, ToastProvider } from "@/app/components/Toast";
import { practiceTimeZone } from "@/config/time";
import { clientRepository, shopOrdersRepository, shopRepository } from "@/data/repositories/server";
import { taskCount } from "@/logic/rules/today-tasks";
import { getTodayTasks } from "@/logic/usecases/today";
import { stockDeps } from "./catalog/stock/deps";
import { todayIn } from "@/logic/rules/dates";
import { countToday } from "@/logic/usecases/clients";

// Second line of defence after the proxy: never render app pages without aal2.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const target = redirectFor(routes.home, await getAuthState(await createClient()));
  if (target) redirect(target);
  // TD1: «Сегодня ③» – never stops a page from opening.
  const today = todayIn(practiceTimeZone);
  // UX1: also what waits in «Магазин» and «Склад препаратов».
  const [clientsWaiting, tasks] = await Promise.all([
    countToday(await clientRepository(), today).catch(() => 0),
    (async () => taskCount(await getTodayTasks(await shopRepository(), await shopOrdersRepository(), await stockDeps(), today)))().catch(() => 0),
  ]);
  const waiting = clientsWaiting + tasks;
  return (
    <ToastProvider>
      {children}
      <Suspense>
        <SavedToast />
      </Suspense>
      <TabBar badges={{ today: waiting }} />
    </ToastProvider>
  );
}
