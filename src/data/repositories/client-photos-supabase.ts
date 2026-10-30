import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClientPhoto } from "@/logic/client-photo";
import type { ClientPhotoRepository } from "./client-photos";

const columns = "id, client_id, course_id, taken_on, storage_path, created_at";

type Row = { id: string; client_id: string; course_id: string | null; taken_on: string; storage_path: string; created_at: string };

const toPhoto = (r: Row): ClientPhoto => ({
  id: r.id,
  clientId: r.client_id,
  courseId: r.course_id,
  takenOn: r.taken_on,
  storagePath: r.storage_path,
  createdAt: r.created_at,
});

/** Supabase-backed client photos. RLS limits every query to the signed-in doctor. */
export function supabaseClientPhotoRepository(supabase: SupabaseClient): ClientPhotoRepository {
  return {
    async listByClient(clientId) {
      const { data, error } = await supabase
        .from("client_photos")
        .select(columns)
        .eq("client_id", clientId)
        .order("taken_on", { ascending: false })
        .order("created_at");
      if (error) throw error;
      return (data as Row[]).map(toPhoto);
    },

    async add(clientId, input) {
      const { error } = await supabase
        .from("client_photos")
        .insert({ client_id: clientId, course_id: input.courseId, taken_on: input.takenOn, storage_path: input.storagePath });
      if (error) throw error;
    },

    async remove(clientId, photoId) {
      const { data, error } = await supabase.from("client_photos").delete().eq("client_id", clientId).eq("id", photoId).select("id");
      if (error) throw error;
      return data.length > 0;
    },
  };
}
