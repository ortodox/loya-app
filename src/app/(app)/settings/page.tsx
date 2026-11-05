import { practiceTimeZone } from "@/config/time";
import { archiveLogRepository } from "@/data/repositories/server";
import { archiveAge } from "@/logic/rules/archive";
import { todayIn } from "@/logic/rules/dates";
import { lastArchiveDate } from "@/logic/usecases/archive";
import { listDeletedClients } from "@/logic/usecases/trash";
import { trashDeps } from "../clients/trash-deps";
import { SettingsView } from "./SettingsView";

/** ST1 ⚙: backup, deleted clients, language and sign out. */
export default async function SettingsPage() {
  const [lastArchive, deleted] = await Promise.all([
    // EX1: «Последний архив» – never stops the page from opening.
    lastArchiveDate(await archiveLogRepository(), practiceTimeZone).catch(() => null),
    listDeletedClients(await trashDeps(), practiceTimeZone),
  ]);
  return <SettingsView archive={archiveAge(lastArchive, todayIn(practiceTimeZone))} deletedCount={deleted.length} />;
}
