import type { SupabaseClient } from "@supabase/supabase-js";
import type { CareRepository } from "./care";

/** Supabase-backed «Уход». RLS limits every query to the signed-in doctor. */
export function supabaseCareRepository(supabase: SupabaseClient): CareRepository {
  return {
    async listPhotos(clientId) {
      const { data, error } = await supabase
        .from("client_care_photos")
        .select("id, storage_path, sort_order")
        .eq("client_id", clientId)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []).map((p) => ({ id: p.id as string, storagePath: p.storage_path as string, sortOrder: p.sort_order as number }));
    },

    async setText(clientId, text, updatedAt) {
      const { data, error } = await supabase
        .from("clients")
        .update({ care_text: text, care_updated_at: updatedAt })
        .eq("id", clientId)
        .select("id");
      if (error) throw error;
      return data.length > 0;
    },

    async addPhoto(clientId, storagePath, sortOrder) {
      const { error } = await supabase
        .from("client_care_photos")
        .insert({ client_id: clientId, storage_path: storagePath, sort_order: sortOrder });
      if (error) throw error;
    },

    async removePhotos(clientId, photoIds) {
      if (photoIds.length === 0) return;
      const { error } = await supabase.from("client_care_photos").delete().eq("client_id", clientId).in("id", photoIds);
      if (error) throw error;
    },
  };
}
