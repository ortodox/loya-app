import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClientTrashRepository } from "./trash";

type FilesRow = {
  visits: { visit_photos: { storage_path: string }[] }[];
  treatment_courses: { course_photos: { storage_path: string }[] }[];
  client_care_photos: { storage_path: string }[];
  client_photos: { storage_path: string }[];
  client_documents: { storage_path: string }[];
};

/** Supabase-backed «Удалённые клиенты». RLS limits every query to the signed-in doctor. */
export function supabaseClientTrashRepository(supabase: SupabaseClient): ClientTrashRepository {
  return {
    async moveToTrash(id, at) {
      const { data, error } = await supabase.from("clients").update({ deleted_at: at }).eq("id", id).is("deleted_at", null).select("id");
      if (error) throw error;
      return data.length > 0;
    },

    async restore(id) {
      const { data, error } = await supabase.from("clients").update({ deleted_at: null }).eq("id", id).not("deleted_at", "is", null).select("id");
      if (error) throw error;
      return data.length > 0;
    },

    async listDeleted() {
      const { data, error } = await supabase
        .from("clients")
        .select("id, full_name, deleted_at")
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });
      if (error) throw error;
      return (data as { id: string; full_name: string; deleted_at: string }[]).map((r) => ({ id: r.id, fullName: r.full_name, deletedAt: r.deleted_at }));
    },

    async filesOf(id) {
      const { data, error } = await supabase
        .from("clients")
        .select(
          "visits(visit_photos(storage_path)), treatment_courses(course_photos(storage_path)), client_care_photos(storage_path), client_photos(storage_path), client_documents(storage_path)",
        )
        .eq("id", id)
        .single();
      if (error) throw error;
      const row = data as unknown as FilesRow;
      const path = (r: { storage_path: string }) => r.storage_path;
      return {
        photos: [
          ...row.visits.flatMap((v) => v.visit_photos.map(path)),
          ...row.treatment_courses.flatMap((c) => c.course_photos.map(path)),
          ...row.client_care_photos.map(path),
          ...row.client_photos.map(path),
        ],
        documents: row.client_documents.map(path),
      };
    },

    async purge(id) {
      const { data, error } = await supabase.from("clients").delete().eq("id", id).not("deleted_at", "is", null).select("id");
      if (error) throw error;
      return data.length > 0;
    },
  };
}
