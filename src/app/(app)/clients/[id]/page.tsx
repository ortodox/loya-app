import { notFound } from "next/navigation";
import { practiceTimeZone } from "@/config/time";
import {
  careRepository,
  clientPhotoRepository,
  clientRepository,
  courseRepository,
  documentRepository,
  documentStorage,
  photoStorage,
  visitRepository,
} from "@/data/repositories/server";
import { todayIn } from "@/logic/rules/dates";
import { getClientCard } from "@/logic/usecases/clients";
import { getCare } from "@/logic/usecases/care";
import { listClientPhotos } from "@/logic/usecases/client-photos";
import { listCoursesForCard } from "@/logic/usecases/courses";
import { listDocuments } from "@/logic/usecases/documents";
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
  const [clients, photos] = await Promise.all([clientRepository(), photoStorage()]);
  const [data, { visits, photoUrls }, courses, care, documents, clientPhotos] = await Promise.all([
    getClientCard(clients, id, todayIn(practiceTimeZone)),
    listVisitsForCard({ visits: await visitRepository(), photos }, id),
    listCoursesForCard({ courses: await courseRepository(), photos }, id),
    getCare({ clients, care: await careRepository(), photos }, id),
    listDocuments({ documents: await documentRepository(), storage: await documentStorage() }, id),
    listClientPhotos({ clientPhotos: await clientPhotoRepository(), photos }, id),
  ]);
  if (!data || !care) notFound();
  return (
    <ClientCardView
      data={data}
      visits={visits}
      photoUrls={photoUrls}
      created={created === "1"}
      today={todayIn(practiceTimeZone)}
      courses={courses}
      care={care}
      documents={documents}
      clientPhotos={clientPhotos}
    />
  );
}
