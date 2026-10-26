import type { SupabaseClient } from "@supabase/supabase-js";
import type { CourseInput, CoursePatch, TreatmentCourse } from "@/logic/course";
import { isLabUnit } from "@/logic/rules/courses";
import type { CourseRepository } from "./courses";

type CourseRow = {
  id: string;
  client_id: string;
  diagnosis: string;
  prescription: string | null;
  start_date: string;
  end_date: string;
  lab_interval_value: number | string | null;
  lab_interval_unit: string | null;
  last_lab_date: string | null;
  status: "active" | "completed";
  completed_at: string | null;
  created_at: string;
  course_photos: { id: string; storage_path: string; created_at: string }[];
};

const columns =
  "id, client_id, diagnosis, prescription, start_date, end_date, lab_interval_value, lab_interval_unit, last_lab_date, " +
  "status, completed_at, created_at, course_photos(id, storage_path, created_at)";

function toCourse(row: CourseRow): TreatmentCourse {
  const value = row.lab_interval_value === null ? null : Number(row.lab_interval_value);
  const unit = row.lab_interval_unit;
  return {
    id: row.id,
    clientId: row.client_id,
    diagnosis: row.diagnosis,
    prescription: row.prescription,
    startDate: row.start_date,
    endDate: row.end_date,
    labInterval: value !== null && unit && isLabUnit(unit) ? { value, unit } : null,
    lastLabDate: row.last_lab_date,
    status: row.status,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    photos: [...row.course_photos]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((p) => ({ id: p.id, storagePath: p.storage_path, createdAt: p.created_at })),
  };
}

const toRow = (input: CourseInput) => ({
  diagnosis: input.diagnosis,
  prescription: input.prescription,
  start_date: input.startDate,
  end_date: input.endDate,
  lab_interval_value: input.labInterval?.value ?? null,
  lab_interval_unit: input.labInterval?.unit ?? null,
  last_lab_date: input.lastLabDate,
});

const patchRow = (patch: CoursePatch) => ({
  ...(patch.endDate !== undefined && { end_date: patch.endDate }),
  ...(patch.status !== undefined && { status: patch.status }),
  ...(patch.completedAt !== undefined && { completed_at: patch.completedAt }),
  ...(patch.lastLabDate !== undefined && { last_lab_date: patch.lastLabDate }),
});

/** Supabase-backed course storage. RLS limits every query to the signed-in doctor. */
export function supabaseCourseRepository(supabase: SupabaseClient): CourseRepository {
  return {
    async listByClient(clientId) {
      const { data, error } = await supabase.from("treatment_courses").select(columns).eq("client_id", clientId);
      if (error) throw error;
      return (data as unknown as CourseRow[]).map(toCourse);
    },

    async get(id) {
      const { data, error } = await supabase.from("treatment_courses").select(columns).eq("id", id).maybeSingle();
      if (error) throw error;
      return data ? toCourse(data as unknown as CourseRow) : null;
    },

    async create(clientId, input) {
      const { data, error } = await supabase
        .from("treatment_courses")
        .insert({ client_id: clientId, ...toRow(input) })
        .select("id")
        .single();
      if (error) throw error;
      return { id: data.id as string };
    },

    async update(id, input) {
      const { data, error } = await supabase.from("treatment_courses").update(toRow(input)).eq("id", id).select("id");
      if (error) throw error;
      return data.length > 0;
    },

    async patch(id, patch) {
      const { data, error } = await supabase.from("treatment_courses").update(patchRow(patch)).eq("id", id).select("id");
      if (error) throw error;
      return data.length > 0;
    },

    async addPhoto(courseId, storagePath) {
      const { error } = await supabase.from("course_photos").insert({ course_id: courseId, storage_path: storagePath });
      if (error) throw error;
    },

    async removePhotos(courseId, photoIds) {
      if (photoIds.length === 0) return;
      const { error } = await supabase.from("course_photos").delete().eq("course_id", courseId).in("id", photoIds);
      if (error) throw error;
    },
  };
}
