import type { SupabaseClient } from "@supabase/supabase-js";
import { thumbnailSide, thumbPath } from "@/logic/rules/thumbnails";
import type { PhotoStorage } from "./photos";

const bucket = "visit-photos";

/** A small JPEG copy for the thumbnails (≈ 20–30 KB instead of the full photo). */
async function makeThumbnail(bytes: Uint8Array): Promise<Uint8Array> {
  const { default: sharp } = await import("sharp");
  const out = await sharp(bytes).rotate().resize(thumbnailSide, thumbnailSide, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 72 }).toBuffer();
  return new Uint8Array(out);
}

/**
 * Supabase Storage; the bucket policy only lets the owner (aal2) read and write her own folder.
 * Every photo gets a small copy next to it (`<id>-t.jpg`); signed links are made for both, and the
 * card shows the small one when it exists (older photos have none).
 */
export function supabasePhotoStorage(supabase: SupabaseClient): PhotoStorage {
  return {
    async upload(folder, bytes) {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) throw error ?? new Error("Not signed in");
      const path = `${data.user.id}/${folder}/${crypto.randomUUID()}.jpg`;
      const res = await supabase.storage.from(bucket).upload(path, bytes, { contentType: "image/jpeg", upsert: false });
      if (res.error) throw res.error;
      try {
        await supabase.storage.from(bucket).upload(thumbPath(path), await makeThumbnail(bytes), { contentType: "image/jpeg", upsert: true });
      } catch {
        // The original is saved; without a small copy the card simply shows the original.
      }
      return path;
    },

    async remove(paths) {
      if (paths.length === 0) return;
      const { error } = await supabase.storage.from(bucket).remove([...paths, ...paths.map(thumbPath)]);
      if (error) throw error;
    },

    async signedUrls(paths) {
      if (paths.length === 0) return {};
      const { data, error } = await supabase.storage.from(bucket).createSignedUrls([...paths, ...paths.map(thumbPath)], 60 * 60);
      if (error) throw error;
      return Object.fromEntries((data ?? []).flatMap((d) => (d.path && d.signedUrl ? [[d.path, d.signedUrl]] : [])));
    },
  };
}
