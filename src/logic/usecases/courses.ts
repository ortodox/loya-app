import type { Client, IsoDate } from "@/logic/client";
import type { TreatmentCourse } from "@/logic/course";
import {
  maxCoursePhotos,
  maxCoursePhotosPerSave,
  parseCourseForm,
  parseLastLabDate,
  splitCourses,
  withDermatology,
  type CourseForm,
  type CourseInputErrors,
} from "@/logic/rules/courses";
import { isIsoDate } from "@/logic/rules/dates";
import { isAcceptablePhoto } from "@/logic/rules/visits";
import type { ClientRepository } from "@/data/repositories/clients";
import type { CourseRepository } from "@/data/repositories/courses";
import type { PhotoStorage } from "@/data/repositories/photos";
import type { PhotoUpload } from "./visits";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type CourseDeps = { clients: ClientRepository; courses: CourseRepository; photos: PhotoStorage };

export type SaveCourseResult =
  | { ok: true; id: string }
  | { ok: false; errors: CourseInputErrors & { photos?: "tooManyPhotos" | "photoInvalid" } }
  | { ok: false; notFound: true };

/** A course, only when it belongs to the client in the URL. */
async function courseOf(courses: CourseRepository, clientId: string, courseId: string): Promise<TreatmentCourse | null> {
  if (!uuid.test(clientId) || !uuid.test(courseId)) return null;
  const course = await courses.get(courseId);
  return course && course.clientId === clientId ? course : null;
}

const signed = (photos: PhotoStorage, courses: readonly TreatmentCourse[]) => {
  const paths = courses.flatMap((c) => c.photos.map((p) => p.storagePath));
  return paths.length > 0 ? photos.signedUrls(paths) : Promise.resolve({});
};

/** LE5/LE9: the client's active courses and the completed ones, with prescription thumbnails. */
export async function listCoursesForCard(
  deps: Pick<CourseDeps, "courses" | "photos">,
  clientId: string,
): Promise<{ active: TreatmentCourse[]; completed: TreatmentCourse[]; photoUrls: Record<string, string> }> {
  if (!uuid.test(clientId)) return { active: [], completed: [], photoUrls: {} };
  const courses = await deps.courses.listByClient(clientId);
  return { ...splitCourses(courses), photoUrls: await signed(deps.photos, courses) };
}

export type CourseFormData = {
  client: Pick<Client, "id" | "fullName">;
  course: TreatmentCourse | null;
  photoUrls: Record<string, string>;
};

/** LE1: what the «Курс лечения» form needs (new: courseId = null). */
export async function getCourseFormData(deps: CourseDeps, clientId: string, courseId: string | null): Promise<CourseFormData | null> {
  if (!uuid.test(clientId)) return null;
  const client = await deps.clients.get(clientId);
  if (!client) return null;
  const course = courseId === null ? null : await courseOf(deps.courses, clientId, courseId);
  if (courseId !== null && !course) return null;
  return {
    client: { id: client.id, fullName: client.fullName },
    course,
    photoUrls: course ? await signed(deps.photos, [course]) : {},
  };
}

/**
 * LE1/LE3/DM1: create (courseId = null) or edit a course with its prescription photos.
 * A new course makes the client a dermatology client.
 */
export async function saveCourse(
  deps: CourseDeps,
  clientId: string,
  courseId: string | null,
  form: CourseForm,
  photos: { add: PhotoUpload[]; removeIds: string[] },
  today: IsoDate,
): Promise<SaveCourseResult> {
  const client = uuid.test(clientId) ? await deps.clients.get(clientId) : null;
  if (!client) return { ok: false, notFound: true };
  const existing = courseId === null ? null : await courseOf(deps.courses, clientId, courseId);
  if (courseId !== null && !existing) return { ok: false, notFound: true };

  const parsed = parseCourseForm(form, today);
  if (!parsed.ok) return parsed;
  const removed = (existing?.photos ?? []).filter((p) => photos.removeIds.includes(p.id));
  const total = (existing?.photos.length ?? 0) - removed.length + photos.add.length;
  if (photos.add.length > maxCoursePhotosPerSave || total > maxCoursePhotos) {
    return { ok: false, errors: { photos: "tooManyPhotos" } };
  }
  if (!photos.add.every(isAcceptablePhoto)) return { ok: false, errors: { photos: "photoInvalid" } };

  let id: string;
  if (existing) {
    if (!(await deps.courses.update(existing.id, parsed.input))) return { ok: false, notFound: true };
    id = existing.id;
  } else {
    id = (await deps.courses.create(clientId, parsed.input)).id;
    // DM1: «Дерматология» is set automatically (it can be unticked in the client form).
    const direction = withDermatology(client.direction);
    if (direction.length !== client.direction.length) await deps.clients.setDirection(clientId, direction);
  }

  if (removed.length > 0) {
    await deps.photos.remove(removed.map((p) => p.storagePath));
    await deps.courses.removePhotos(id, removed.map((p) => p.id));
  }
  for (const photo of photos.add) {
    const path = await deps.photos.upload(`courses/${id}`, photo.bytes);
    await deps.courses.addPhoto(id, path);
  }
  return { ok: true, id };
}

/** LE9: «Завершить курс» – the course moves to «Завершённые курсы». */
export async function completeCourse(deps: Pick<CourseDeps, "courses">, clientId: string, courseId: string, today: IsoDate) {
  const course = await courseOf(deps.courses, clientId, courseId);
  if (!course || course.status === "completed") return false;
  return deps.courses.patch(course.id, { status: "completed", completedAt: today });
}

/** LE2: «Продлить» – a new approximate end date; a completed course becomes active again. */
export async function extendCourse(
  deps: Pick<CourseDeps, "courses">,
  clientId: string,
  courseId: string,
  endDate: string,
): Promise<{ ok: true } | { ok: false; error: "dateInvalid" | "endBeforeStart" | "notFound" }> {
  const course = await courseOf(deps.courses, clientId, courseId);
  if (!course) return { ok: false, error: "notFound" };
  if (!isIsoDate(endDate)) return { ok: false, error: "dateInvalid" };
  if (endDate < course.startDate) return { ok: false, error: "endBeforeStart" };
  await deps.courses.patch(course.id, { endDate, status: "active", completedAt: null });
  return { ok: true };
}

/** LE6: «Анализы сданы ✓» – the next tests are counted from today. */
export async function markLabsDone(deps: Pick<CourseDeps, "courses">, clientId: string, courseId: string, today: IsoDate) {
  const course = await courseOf(deps.courses, clientId, courseId);
  if (!course || !course.labInterval) return false;
  return deps.courses.patch(course.id, { lastLabDate: today });
}

/** LE6: change or clear «Последние анализы»; cleared = the next tests are counted from the start again. */
export async function setLastLabDate(
  deps: Pick<CourseDeps, "courses">,
  clientId: string,
  courseId: string,
  text: string,
  today: IsoDate,
): Promise<boolean> {
  const course = await courseOf(deps.courses, clientId, courseId);
  const parsed = parseLastLabDate(text, today);
  if (!course || !course.labInterval || !parsed.ok) return false;
  return deps.courses.patch(course.id, { lastLabDate: parsed.date });
}
