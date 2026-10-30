import { notFound } from "next/navigation";
import { practiceTimeZone } from "@/config/time";
import { todayIn } from "@/logic/rules/dates";
import { getClientPhotoFormData } from "@/logic/usecases/client-photos";
import { addClientPhotosAction } from "../actions";
import { ClientPhotoForm } from "../ClientPhotoForm";
import { clientPhotoDeps } from "../deps";

/** FK1/FK3: «+ Фото» – to «Фото клиента», or with ?course=<id> to a treatment course. */
export default async function NewClientPhotosPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ course?: string }>;
}) {
  const [{ id }, { course }] = await Promise.all([params, searchParams]);
  const data = await getClientPhotoFormData(await clientPhotoDeps(), id, course ?? null);
  if (!data) notFound();
  const back = `/clients/${id}#${data.course ? `course-${data.course.id}` : "client-photos"}`;
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-2 pb-8">
      <ClientPhotoForm
        cancelHref={back}
        today={todayIn(practiceTimeZone)}
        course={data.course}
        action={addClientPhotosAction.bind(null, id, data.course?.id ?? null)}
      />
    </main>
  );
}
