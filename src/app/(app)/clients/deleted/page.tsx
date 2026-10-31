import { practiceTimeZone } from "@/config/time";
import { DeletedClientsView } from "./DeletedClientsView";
import { listDeletedClients } from "@/logic/usecases/trash";
import { trashDeps } from "../trash-deps";

/** PR6 «Удалённые клиенты»: restore within 30 days. */
export default async function DeletedClientsPage({ searchParams }: { searchParams: Promise<{ failed?: string }> }) {
  const { failed } = await searchParams;
  const deleted = await listDeletedClients(await trashDeps(), practiceTimeZone);
  return <DeletedClientsView deleted={deleted} failed={failed === "1"} />;
}
