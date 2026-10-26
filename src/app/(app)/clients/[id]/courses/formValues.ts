import type { TreatmentCourse } from "@/logic/course";
import type { CourseForm } from "@/logic/rules/courses";

/** LE1: the form's starting values – a new course starts today. */
export function courseFormValues(course: TreatmentCourse | null, today: string): CourseForm {
  if (!course) return { startDate: today, labUnit: "months" };
  return {
    diagnosis: course.diagnosis,
    prescription: course.prescription ?? "",
    startDate: course.startDate,
    endDate: course.endDate,
    labEnabled: course.labInterval ? "1" : "",
    labValue: course.labInterval ? String(course.labInterval.value).replace(".", ",") : "",
    labUnit: course.labInterval?.unit ?? "months",
    lastLabDate: course.lastLabDate ?? "",
  };
}
