import { practiceTimeZone } from "@/config/time";
import { clientRepository } from "@/data/repositories/server";
import { todayIn } from "@/logic/rules/dates";
import { listClients } from "@/logic/usecases/clients";
import { ClientsView } from "./ClientsView";

export default async function ClientsPage() {
  const clients = await listClients(await clientRepository(), todayIn(practiceTimeZone));
  return <ClientsView clients={clients} />;
}
