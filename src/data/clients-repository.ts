import type { SupabaseClient } from "@supabase/supabase-js";
import type { Client, ClientInput, FieldValue } from "@/logic/client";
import type { ClientRepository } from "@/logic/usecases/client-repository";
import { isLocale } from "@/logic/locale";

type ClientRow = {
  id: string;
  full_name: string;
  card_date: string;
  age_at_registration: number | null;
  birth_date: string | null;
  phone: string | null;
  language: string | null;
  complaints: FieldValue;
  anamnesis: Record<string, FieldValue> | null;
  notes: string | null;
  updated_at: string;
  visits?: { visit_date: string }[];
};

const columns =
  "id, full_name, card_date, age_at_registration, birth_date, phone, language, complaints, anamnesis, notes, updated_at";

function toClient(row: ClientRow): Client {
  return {
    id: row.id,
    fullName: row.full_name,
    cardDate: row.card_date,
    ageAtRegistration: row.age_at_registration,
    birthDate: row.birth_date,
    phone: row.phone,
    language: isLocale(row.language) ? row.language : null,
    complaints: row.complaints,
    anamnesis: row.anamnesis ?? {},
    notes: row.notes,
    lastVisitDate: row.visits?.[0]?.visit_date ?? null,
    updatedAt: row.updated_at,
  };
}

function toRow(input: ClientInput) {
  return {
    full_name: input.fullName,
    card_date: input.cardDate,
    age_at_registration: input.ageAtRegistration,
    birth_date: input.birthDate,
    phone: input.phone,
    language: input.language,
    notes: input.notes,
  };
}

/** Supabase-backed client storage. RLS limits every query to the signed-in doctor. */
export function supabaseClientRepository(supabase: SupabaseClient): ClientRepository {
  const withLastVisit = () =>
    supabase
      .from("clients")
      .select(`${columns}, visits(visit_date)`)
      .order("visit_date", { referencedTable: "visits", ascending: false })
      .limit(1, { referencedTable: "visits" });

  return {
    async list() {
      const { data, error } = await withLastVisit();
      if (error) throw error;
      return (data as ClientRow[]).map(toClient);
    },

    async get(id) {
      const { data, error } = await withLastVisit().eq("id", id).maybeSingle();
      if (error) throw error;
      return data ? toClient(data as ClientRow) : null;
    },

    async create(input) {
      const { data, error } = await supabase.from("clients").insert(toRow(input)).select("id").single();
      if (error) throw error;
      return { id: data.id as string };
    },

    async update(id, input) {
      const { data, error } = await supabase
        .from("clients")
        .update(toRow(input))
        .eq("id", id)
        .select("id");
      if (error) throw error;
      return data.length > 0;
    },
  };
}
