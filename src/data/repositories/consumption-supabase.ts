import type { SupabaseClient } from "@supabase/supabase-js";
import type { Localized } from "@/logic/catalog";
import type { ConsumptionRepository } from "./consumption";

type TypeRow = { id: string; code: string | null; name: Localized | null };
type Row = {
  id: string;
  created_at: string;
  client_id: string;
  visit_date: string;
  remind_on: string | null;
  reminder_done_at: string | null;
  visit_items: { preparation_id: string | null; preparation_name: string; quantity: string | null; procedure_types: TypeRow | TypeRow[] | null }[];
};

const one = (t: TypeRow | TypeRow[] | null) => (Array.isArray(t) ? t[0] ?? null : t);

/** Supabase-backed «Расход». RLS limits every query to the signed-in doctor; deleted clients are left out. */
export function supabaseConsumptionRepository(supabase: SupabaseClient): ConsumptionRepository {
  return {
    async listVisits() {
      const { data, error } = await supabase
        .from("visits")
        .select("id, created_at, client_id, visit_date, remind_on, reminder_done_at, clients!inner(deleted_at), visit_items(preparation_id, preparation_name, quantity, procedure_types(id, code, name))")
        .is("clients.deleted_at", null);
      if (error) throw error;
      return (data as unknown as Row[]).map((v) => ({
        visitId: v.id,
        createdAt: v.created_at,
        clientId: v.client_id,
        visitDate: v.visit_date,
        remindOn: v.reminder_done_at ? null : v.remind_on,
        items: v.visit_items.map((i) => {
          const type = one(i.procedure_types);
          return {
            key: i.preparation_id ?? `name:${i.preparation_name}`,
            name: i.preparation_name,
            type: type ? { id: type.id, code: type.code, name: type.name ?? {} } : null,
            quantity: i.quantity,
          };
        }),
      }));
    },
  };
}
