import { notFound } from "next/navigation";
import { practiceTimeZone } from "@/config/time";
import { clientRepository, visitRepository } from "@/data/repositories/server";
import { todayIn } from "@/logic/rules/dates";
import { getClientCard } from "@/logic/usecases/clients";
import { listVisits } from "@/logic/usecases/visits";
import { ClientCardView } from "./ClientCardView";

export default async function ClientCardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [data, visits] = await Promise.all([
    getClientCard(await clientRepository(), id, todayIn(practiceTimeZone)),
    listVisits(await visitRepository(), id),
  ]);
  if (!data) notFound();
  return <ClientCardView data={data} visits={visits} />;
}
