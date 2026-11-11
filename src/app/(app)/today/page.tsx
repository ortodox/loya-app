import { practiceTimeZone } from "@/config/time";
import { clientRepository, shopOrdersRepository, shopRepository } from "@/data/repositories/server";
import { todayIn } from "@/logic/rules/dates";
import { listClients } from "@/logic/usecases/clients";
import { getTodayTasks } from "@/logic/usecases/today";
import { stockDeps } from "../catalog/stock/deps";
import { TodayView } from "./TodayView";

export const dynamic = "force-dynamic";

/** TD1/UX1 «Сегодня»: what waits today – clients, and what needs doing in «Магазин» and «Склад препаратов». */
export default async function TodayPage() {
  const today = todayIn(practiceTimeZone);
  const [clients, tasks] = await Promise.all([
    listClients(await clientRepository(), today),
    getTodayTasks(await shopRepository(), await shopOrdersRepository(), await stockDeps(), today),
  ]);
  return <TodayView clients={clients} tasks={tasks} today={today} />;
}
