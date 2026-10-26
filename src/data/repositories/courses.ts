import type { CourseInput, CoursePatch, TreatmentCourse } from "@/logic/course";

/** Treatment course storage (LE1); Supabase implementation in ./courses-supabase, faked in tests. */
export interface CourseRepository {
  listByClient(clientId: string): Promise<TreatmentCourse[]>;
  get(id: string): Promise<TreatmentCourse | null>;
  create(clientId: string, input: CourseInput): Promise<{ id: string }>;
  update(id: string, input: CourseInput): Promise<boolean>;
  /** LE2/LE6/LE9: «Продлить», «Анализы сданы ✓», «Завершить курс». */
  patch(id: string, patch: CoursePatch): Promise<boolean>;
  /** LE3: a prescription photo, newest shown first. */
  addPhoto(courseId: string, storagePath: string): Promise<void>;
  removePhotos(courseId: string, photoIds: string[]): Promise<void>;
}
