"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { practiceTimeZone } from "@/config/time";
import type { CourseForm } from "@/logic/rules/courses";
import { todayIn } from "@/logic/rules/dates";
import {
  completeCourse,
  extendCourse,
  markLabsDone,
  saveCourse,
  type SaveCourseResult,
} from "@/logic/usecases/courses";
import type { PhotoUpload } from "@/logic/usecases/visits";
import { courseDeps as deps } from "./deps";

export type CourseFormState = {
  values: CourseForm;
  errors?: Extract<SaveCourseResult, { errors: unknown }>["errors"];
  failed?: boolean;
};

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");
const fields = ["diagnosis", "prescription", "startDate", "endDate", "labEnabled", "labValue", "labUnit", "lastLabDate"] as const;

function backToCard(clientId: string): never {
  revalidatePath("/clients");
  revalidatePath(`/clients/${clientId}`);
  redirect(`/clients/${clientId}`);
}

/** LE1/LE3: save the course form with new and removed prescription photos. */
export async function saveCourseAction(
  clientId: string,
  courseId: string | null,
  _: CourseFormState,
  fd: FormData,
): Promise<CourseFormState> {
  const values: CourseForm = Object.fromEntries(fields.map((f) => [f, str(fd.get(f))]));
  const files = fd.getAll("photos").filter((f): f is File => typeof f !== "string" && f.size > 0);
  const add: PhotoUpload[] = await Promise.all(
    files.slice(0, 4).map(async (f) => ({ bytes: new Uint8Array(await f.arrayBuffer()), type: f.type, size: f.size })),
  );
  const removeIds = fd.getAll("removePhotoIds").map(str).filter(Boolean);
  let result: SaveCourseResult;
  try {
    result = await saveCourse(await deps(), clientId, courseId, values, { add, removeIds }, todayIn(practiceTimeZone));
  } catch {
    return { values, failed: true };
  }
  if (!result.ok) return "errors" in result ? { values, errors: result.errors } : { values, failed: true };
  backToCard(clientId);
}

/** LE9: «Завершить курс». */
export async function completeCourseAction(clientId: string, courseId: string) {
  await completeCourse(await deps(), clientId, courseId, todayIn(practiceTimeZone));
  backToCard(clientId);
}

/** LE2: «Продлить» with a new end date. */
export async function extendCourseAction(clientId: string, courseId: string, fd: FormData) {
  await extendCourse(await deps(), clientId, courseId, str(fd.get("endDate")));
  backToCard(clientId);
}

/** LE6: «Анализы сданы ✓». */
export async function labsDoneAction(clientId: string, courseId: string) {
  await markLabsDone(await deps(), clientId, courseId, todayIn(practiceTimeZone));
  backToCard(clientId);
}
