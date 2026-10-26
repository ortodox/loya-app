import type { SupabaseClient } from "@supabase/supabase-js";
import type { Locale } from "@/config/locales";
import type { Visit, VisitInput } from "@/logic/client";
import { isLocale } from "@/logic/locale";
import { storedAsEdited } from "@/logic/rules/recommendations";
import type { VisitRepository } from "./visits";

type VisitRow = {
  id: string;
  client_id: string;
  visit_date: string;
  created_at: string;
  notes: string | null;
  recommendations: string | null;
  recommendations_lang: string | null;
  recommendations_edited: boolean | null;
  home_care_recommendations: string | null;
  procedure_plan: string | null;
  visit_items: {
    id: string;
    preparation_id: string | null;
    preparation_name: string;
    procedure_type_id: string | null;
    quantity: string | null;
    sort_order: number;
  }[];
  visit_photos: { id: string; storage_path: string; sort_order: number }[];
};

const columns =
  "id, client_id, visit_date, created_at, notes, recommendations, recommendations_lang, recommendations_edited, home_care_recommendations, procedure_plan, " +
  "visit_items(id, preparation_id, preparation_name, procedure_type_id, quantity, sort_order), " +
  "visit_photos(id, storage_path, sort_order)";

function toVisit(row: VisitRow): Visit {
  return {
    id: row.id,
    clientId: row.client_id,
    visitDate: row.visit_date,
    createdAt: row.created_at,
    notes: row.notes,
    recommendations: row.recommendations,
    recommendationsLang: isLocale(row.recommendations_lang) ? (row.recommendations_lang as Locale) : null,
    recommendationsEdited: storedAsEdited(row.recommendations_edited, row.recommendations),
    items: [...row.visit_items]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((i) => ({
        id: i.id,
        preparationId: i.preparation_id,
        preparationName: i.preparation_name,
        procedureTypeId: i.procedure_type_id,
        quantity: i.quantity,
        sortOrder: i.sort_order,
      })),
    photos: [...row.visit_photos]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((p) => ({ id: p.id, storagePath: p.storage_path, sortOrder: p.sort_order })),
    archive: { homeCareRecommendations: row.home_care_recommendations, procedurePlan: row.procedure_plan },
  };
}

const visitRow = (input: VisitInput) => ({
  visit_date: input.visitDate,
  notes: input.notes,
  recommendations: input.recommendations,
  recommendations_lang: input.recommendationsLang,
  recommendations_edited: input.recommendationsEdited,
});

/** Supabase-backed visit storage. RLS limits every query to the signed-in doctor. */
export function supabaseVisitRepository(supabase: SupabaseClient): VisitRepository {
  async function insertItems(visitId: string, input: VisitInput) {
    if (input.items.length === 0) return;
    const { error } = await supabase.from("visit_items").insert(
      input.items.map((item, i) => ({
        visit_id: visitId,
        preparation_id: item.preparationId,
        preparation_name: item.preparationName,
        procedure_type_id: item.procedureTypeId,
        quantity: item.quantity,
        sort_order: i,
      })),
    );
    if (error) throw error;
  }

  return {
    async listByClient(clientId) {
      const { data, error } = await supabase
        .from("visits")
        .select(columns)
        .eq("client_id", clientId)
        .order("visit_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as unknown as VisitRow[]).map(toVisit);
    },

    async get(id) {
      const { data, error } = await supabase.from("visits").select(columns).eq("id", id).maybeSingle();
      if (error) throw error;
      return data ? toVisit(data as unknown as VisitRow) : null;
    },

    async create(clientId, input) {
      // doctor_id defaults to auth.uid(); the (client_id, doctor_id) foreign key rejects other doctors' clients.
      const { data, error } = await supabase
        .from("visits")
        .insert({ client_id: clientId, ...visitRow(input) })
        .select("id")
        .single();
      if (error) throw error;
      const id = data.id as string;
      await insertItems(id, input);
      return { id };
    },

    async update(id, input) {
      const { data, error } = await supabase.from("visits").update(visitRow(input)).eq("id", id).select("id");
      if (error) throw error;
      if (data.length === 0) return false;
      const removed = await supabase.from("visit_items").delete().eq("visit_id", id);
      if (removed.error) throw removed.error;
      await insertItems(id, input);
      return true;
    },

    async delete(id) {
      const { data, error } = await supabase.from("visits").delete().eq("id", id).select("id");
      if (error) throw error;
      return data.length > 0;
    },

    async addPhoto(visitId, storagePath, sortOrder) {
      const { error } = await supabase
        .from("visit_photos")
        .insert({ visit_id: visitId, storage_path: storagePath, sort_order: sortOrder });
      if (error) throw error;
    },

    async removePhotos(visitId, photoIds) {
      if (photoIds.length === 0) return;
      const { error } = await supabase.from("visit_photos").delete().eq("visit_id", visitId).in("id", photoIds);
      if (error) throw error;
    },
  };
}
