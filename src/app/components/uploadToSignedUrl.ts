"use client";

/**
 * DK1: send a file straight to Supabase Storage with a one-time signed upload link from the
 * server (the same request supabase-js `uploadToSignedUrl` makes). Large PDFs never pass through
 * a server action, whose body limit is 4 MB.
 */
export async function uploadToSignedUrl(uploadUrl: string, file: File): Promise<boolean> {
  const body = new FormData();
  body.append("cacheControl", "3600");
  body.append("", file);
  try {
    const res = await fetch(uploadUrl, { method: "PUT", body, headers: { "x-upsert": "false" } });
    return res.ok;
  } catch {
    return false;
  }
}
