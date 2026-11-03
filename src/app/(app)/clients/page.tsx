import { practiceTimeZone } from "@/config/time";
import { archiveLogRepository, clientRepository, photoStorage } from "@/data/repositories/server";
import { archiveAge } from "@/logic/rules/archive";
import { todayIn } from "@/logic/rules/dates";
import { clientPictureUrls, listClients } from "@/logic/usecases/clients";
import { lastArchiveDate } from "@/logic/usecases/archive";
import { listDeletedClients, purgeExpiredClients } from "@/logic/usecases/trash";
import { ClientsView } from "./ClientsView";
import { trashDeps } from "./trash-deps";

export default async function ClientsPage() {
  // PR6: clients that have been in «Удалённые клиенты» for 30 days are deleted for good first.
  const trash = await trashDeps();
  await purgeExpiredClients(trash, new Date()).catch(() => 0);
  const today = todayIn(practiceTimeZone);
  const [clients, deleted, lastArchive] = await Promise.all([
    listClients(await clientRepository(), today),
    listDeletedClients(trash, practiceTimeZone),
    // EX1: «Последний архив» – never stops the list from opening.
    lastArchiveDate(await archiveLogRepository(), practiceTimeZone).catch(() => null),
  ]);
  const pictureUrls = await clientPictureUrls(await photoStorage(), clients);
  return <ClientsView clients={clients} deletedCount={deleted.length} pictureUrls={pictureUrls} archive={archiveAge(lastArchive, today)} />;
}
