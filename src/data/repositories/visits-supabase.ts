import type { SupabaseClient } from "@supabase/supabase-js";
import type { Visit, VisitInput } from "@/logic/client";
import type { VisitRepository } from "./visits";

type VisitRow = {
  id: string;
  client_id: string;
  visit_date: string;
  home_care_recommendations: string | null;
  procedure_plan: string | null;
  created_at: string;
};

const columns = "id, client_id, visit_date, home_care_recommendations, procedure_plan, created_at";

function toVisit(row: VisitRow): Visit {
  return {
    id: row.id,
    clientId: row.client_id,
    visitDate: row.visit_date,
    homeCareRecommendations: row.home_care_recommendations,
    procedurePlan: row.procedure_plan,
    createdAt: row.created_at,
  };
}

function toRow(input: VisitInput) {
  return {
    visit_date: input.visitDate,
    home_care_recommendations: input.homeCareRecommendations,
    procedure_plan: input.procedurePlan,
  };
}

/** Supabase-backed visit storage. RLS limits every query to the signed-in doctor. */
export function supabaseVisitRepository(supabase: SupabaseClient): VisitRepository {
  return {
    async listByClient(clientId) {
      const { data, error } = await supabase
        .from("visits")
        .select(columns)
        .eq("client_id", clientId)
        .order("visit_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as VisitRow[]).map(toVisit);
    },

    async get(id) {
      const { data, error } = await supabase.from("visits").select(columns).eq("id", id).maybeSingle();
      if (error) throw error;
      return data ? toVisit(data as VisitRow) : null;
    },

    async create(clientId, input) {
      // doctor_id defaults to auth.uid(); the (client_id, doctor_id) foreign key rejects other doctors' clients.
      const { data, error } = await supabase
        .from("visits")
        .insert({ client_id: clientId, ...toRow(input) })
        .select("id")
        .single();
      if (error) throw error;
      return { id: data.id as string };
    },

    async update(id, input) {
      const { data, error } = await supabase.from("visits").update(toRow(input)).eq("id", id).select("id");
      if (error) throw error;
      return data.length > 0;
    },

    async delete(id) {
      const { data, error } = await supabase.from("visits").delete().eq("id", id).select("id");
      if (error) throw error;
      return data.length > 0;
    },
  };
}
