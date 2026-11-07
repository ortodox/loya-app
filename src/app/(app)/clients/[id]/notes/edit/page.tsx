import { notFound } from "next/navigation";
import { practiceTimeZone } from "@/config/time";
import { clientRepository } from "@/data/repositories/server";
import { todayIn } from "@/logic/rules/dates";
import { getClientCard } from "@/logic/usecases/clients";
import { saveNotesAction } from "../actions";
import { NotesForm } from "../NotesForm";

/** ZM1: «+ Заметка» / «Изменить» in the card's «Заметки». */
export default async function NotesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getClientCard(await clientRepository(), id, todayIn(practiceTimeZone));
  if (!data) notFound();
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-2 pb-8">
      <NotesForm cancelHref={`/clients/${id}#notes`} notes={data.client.notes ?? ""} action={saveNotesAction.bind(null, id)} />
    </main>
  );
}
