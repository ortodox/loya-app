import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { practiceTimeZone } from "@/config/time";
import { todayIn } from "@/logic/rules/dates";
import { getCourseFormData } from "@/logic/usecases/courses";
import { saveCourseAction } from "../../actions";
import { CourseForm } from "../../CourseForm";
import { courseDeps } from "../../deps";
import { courseFormValues } from "../../formValues";

export default async function CoursePage({ params }: { params: Promise<{ id: string; courseId: string }> }) {
  const { id, courseId } = await params;
  const data = await getCourseFormData(await courseDeps(), id, courseId);
  if (!data) notFound();
  const t = await getTranslations("courses");
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-2 pb-8">
      <CourseForm
        title={t("editTitle")}
        cancelHref={`/clients/${id}`}
        initial={courseFormValues(data.course, todayIn(practiceTimeZone))}
        photos={(data.course?.photos ?? []).map((p) => ({ id: p.id, url: data.photoUrls[p.storagePath] ?? null }))}
        action={saveCourseAction.bind(null, id, courseId)}
      />
    </main>
  );
}
