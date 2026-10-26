import { notFound } from "next/navigation";
import { practiceTimeZone } from "@/config/time";
import { clientRepository, courseRepository, photoStorage, visitRepository } from "@/data/repositories/server";
import { todayIn } from "@/logic/rules/dates";
import { getClientCard } from "@/logic/usecases/clients";
import { listCoursesForCard } from "@/logic/usecases/courses";
import { listVisitsForCard } from "@/logic/usecases/visits";
import { ClientCardView } from "./ClientCardView";

export default async function ClientCardPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const [{ id }, { created }] = await Promise.all([params, searchParams]);
  const photos = await photoStorage();
  const [data, { visits, photoUrls }, courses] = await Promise.all([
    getClientCard(await clientRepository(), id, todayIn(practiceTimeZone)),
    listVisitsForCard({ visits: await visitRepository(), photos }, id),
    listCoursesForCard({ courses: await courseRepository(), photos }, id),
  ]);
  if (!data) notFound();
  return <ClientCardView data={data} visits={visits} photoUrls={photoUrls} created={created === "1"} today={todayIn(practiceTimeZone)} courses={courses} />;
}
