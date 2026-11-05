import { practiceTimeZone } from "@/config/time";
import { clientRepository } from "@/data/repositories/server";
import { todayIn } from "@/logic/rules/dates";
import { listClients } from "@/logic/usecases/clients";
import { TodayView } from "./TodayView";

/** TD1 «Сегодня»: what waits today, from the same client summaries as the list. */
export default async function TodayPage() {
  const today = todayIn(practiceTimeZone);
  return <TodayView clients={await listClients(await clientRepository(), today)} today={today} />;
}
