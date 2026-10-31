import { practiceTimeZone } from "@/config/time";
import { clientRepository } from "@/data/repositories/server";
import { todayIn } from "@/logic/rules/dates";
import { listClients } from "@/logic/usecases/clients";
import { listDeletedClients, purgeExpiredClients } from "@/logic/usecases/trash";
import { ClientsView } from "./ClientsView";
import { trashDeps } from "./trash-deps";

export default async function ClientsPage() {
  // PR6: clients that have been in «Удалённые клиенты» for 30 days are deleted for good first.
  const trash = await trashDeps();
  await purgeExpiredClients(trash, new Date()).catch(() => 0);
  const [clients, deleted] = await Promise.all([
    listClients(await clientRepository(), todayIn(practiceTimeZone)),
    listDeletedClients(trash, practiceTimeZone),
  ]);
  return <ClientsView clients={clients} deletedCount={deleted.length} />;
}
