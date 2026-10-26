import type { SupabaseClient } from "@supabase/supabase-js";
import type { PhotoStorage } from "./photos";

const bucket = "visit-photos";

/** Supabase Storage; the bucket policy only lets the owner (aal2) read and write her own folder. */
export function supabasePhotoStorage(supabase: SupabaseClient): PhotoStorage {
  return {
    async upload(visitId, bytes) {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) throw error ?? new Error("Not signed in");
      const path = `${data.user.id}/${visitId}/${crypto.randomUUID()}.jpg`;
      const res = await supabase.storage.from(bucket).upload(path, bytes, { contentType: "image/jpeg", upsert: false });
      if (res.error) throw res.error;
      return path;
    },

    async remove(paths) {
      if (paths.length === 0) return;
      const { error } = await supabase.storage.from(bucket).remove(paths);
      if (error) throw error;
    },

    async signedUrls(paths) {
      if (paths.length === 0) return {};
      const { data, error } = await supabase.storage.from(bucket).createSignedUrls(paths, 60 * 60);
      if (error) throw error;
      return Object.fromEntries((data ?? []).flatMap((d) => (d.path && d.signedUrl ? [[d.path, d.signedUrl]] : [])));
    },
  };
}
