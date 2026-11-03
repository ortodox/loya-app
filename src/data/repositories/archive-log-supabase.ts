import type { SupabaseClient } from "@supabase/supabase-js";
import type { ArchiveLogRepository } from "./archive-log";

/** Supabase-backed archive log. RLS limits every query to the signed-in doctor. */
export function supabaseArchiveLogRepository(supabase: SupabaseClient): ArchiveLogRepository {
  return {
    async lastDownload() {
      const { data, error } = await supabase.from("archive_downloads").select("created_at").order("created_at", { ascending: false }).limit(1);
      if (error) throw error;
      return (data as { created_at: string }[])[0]?.created_at ?? null;
    },
    async recordDownload() {
      const { error } = await supabase.from("archive_downloads").insert({});
      if (error) throw error;
    },
  };
}
