import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClientDocument, DocumentInput } from "@/logic/document";
import { isDocumentType } from "@/logic/rules/documents";
import type { DocumentRepository, DocumentStorage } from "./documents";

const bucket = "client-documents";

type DocumentRow = {
  id: string;
  client_id: string;
  course_id: string | null;
  title: string | null;
  document_date: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
};

const columns = "id, client_id, course_id, title, document_date, storage_path, mime_type, size_bytes, created_at";

const toDocument = (row: DocumentRow): ClientDocument => ({
  id: row.id,
  clientId: row.client_id,
  courseId: row.course_id,
  title: row.title,
  documentDate: row.document_date,
  storagePath: row.storage_path,
  mimeType: isDocumentType(row.mime_type) ? row.mime_type : "application/pdf",
  sizeBytes: Number(row.size_bytes),
  createdAt: row.created_at,
});

/** Supabase-backed document rows. RLS limits every query to the signed-in doctor. */
export function supabaseDocumentRepository(supabase: SupabaseClient): DocumentRepository {
  return {
    async listByClient(clientId) {
      const { data, error } = await supabase.from("client_documents").select(columns).eq("client_id", clientId);
      if (error) throw error;
      return (data as DocumentRow[]).map(toDocument);
    },

    async get(id) {
      const { data, error } = await supabase.from("client_documents").select(columns).eq("id", id).maybeSingle();
      if (error) throw error;
      return data ? toDocument(data as DocumentRow) : null;
    },

    async create(clientId, input: DocumentInput) {
      const { data, error } = await supabase
        .from("client_documents")
        .insert({
          client_id: clientId,
          course_id: input.courseId,
          title: input.title,
          document_date: input.documentDate,
          storage_path: input.storagePath,
          mime_type: input.mimeType,
          size_bytes: input.sizeBytes,
        })
        .select("id")
        .single();
      if (error) throw error;
      return { id: data.id as string };
    },

    async delete(id) {
      const { data, error } = await supabase.from("client_documents").delete().eq("id", id).select("id");
      if (error) throw error;
      return data.length > 0;
    },
  };
}

/** Supabase Storage; the bucket policy only lets the owner (aal2) read and write her own folder. */
export function supabaseDocumentStorage(supabase: SupabaseClient): DocumentStorage {
  async function userId() {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw error ?? new Error("Not signed in");
    return data.user.id;
  }

  return {
    async createUpload(clientId, extension) {
      const path = `${await userId()}/${clientId}/${crypto.randomUUID()}.${extension}`;
      const { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(path);
      if (error) throw error;
      return { path, uploadUrl: data.signedUrl };
    },

    async exists(path) {
      const uid = await userId();
      const slash = path.lastIndexOf("/");
      if (!path.startsWith(`${uid}/`) || slash < 0) return false;
      const { data, error } = await supabase.storage.from(bucket).list(path.slice(0, slash), { search: path.slice(slash + 1) });
      if (error) throw error;
      return (data ?? []).some((f) => f.name === path.slice(slash + 1));
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
