import { redirect } from "next/navigation";
import { createClient } from "@/data/supabase/server";
import { getAuthState } from "@/data/supabase/session";
import { redirectFor } from "@/logic/auth-step";
import { routes } from "@/config/routes";
import { TabBar } from "@/app/components/TabBar";

// Second line of defence after the proxy: never render app pages without aal2.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const target = redirectFor(routes.home, await getAuthState(await createClient()));
  if (target) redirect(target);
  return (
    <>
      {children}
      <TabBar />
    </>
  );
}
