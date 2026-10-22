import { notFound } from "next/navigation";
import { practiceTimeZone } from "@/config/time";
import { clientRepository } from "@/data/repositories/server";
import { todayIn } from "@/logic/rules/dates";
import { getClientCard } from "@/logic/usecases/clients";
import { ClientCardView } from "./ClientCardView";

export default async function ClientCardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getClientCard(await clientRepository(), id, todayIn(practiceTimeZone));
  if (!data) notFound();
  return <ClientCardView data={data} />;
}
