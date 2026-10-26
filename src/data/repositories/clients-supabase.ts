import type { SupabaseClient } from "@supabase/supabase-js";
import type { Anamnesis, Client, ClientInput } from "@/logic/client";
import type { ClientRepository } from "./clients";
import { isLocale } from "@/logic/locale";

type ClientRow = {
  id: string;
  full_name: string;
  card_date: string;
  age_at_registration: number | null;
  birth_date: string | null;
  phone: string | null;
  email: string | null;
  residence_country: string | null;
  residence_city: string | null;
  language: string | null;
  anamnesis: Anamnesis | null;
  notes: string | null;
  procedure_plan: string | null;
  anamnesis_confirmed_at: string | null;
  updated_at: string;
  visits?: { visit_date: string }[];
};

const columns =
  "id, full_name, card_date, age_at_registration, birth_date, phone, email, residence_country, residence_city, language, anamnesis, notes, procedure_plan, anamnesis_confirmed_at, updated_at";

function toClient(row: ClientRow): Client {
  return {
    id: row.id,
    fullName: row.full_name,
    cardDate: row.card_date,
    ageAtRegistration: row.age_at_registration,
    birthDate: row.birth_date,
    phone: row.phone,
    email: row.email,
    residenceCountry: row.residence_country,
    residenceCity: row.residence_city,
    language: isLocale(row.language) ? row.language : null,
    anamnesis: row.anamnesis ?? {},
    notes: row.notes,
    procedurePlan: row.procedure_plan,
    anamnesisConfirmedAt: row.anamnesis_confirmed_at,
    visitDates: (row.visits ?? []).map((v) => v.visit_date),
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
    email: input.email,
    residence_country: input.residenceCountry,
    residence_city: input.residenceCity,
    language: input.language,
    anamnesis: input.anamnesis,
    notes: input.notes,
    procedure_plan: input.procedurePlan,
  };
}

/** Supabase-backed client storage. RLS limits every query to the signed-in doctor. */
export function supabaseClientRepository(supabase: SupabaseClient): ClientRepository {
  // VS1/VP2: all visit dates, so the list can show the last visit and the next appointment.
  const withVisits = () => supabase.from("clients").select(`${columns}, visits(visit_date)`);

  return {
    async list() {
      const { data, error } = await withVisits();
      if (error) throw error;
      return (data as ClientRow[]).map(toClient);
    },

    async get(id) {
      const { data, error } = await withVisits().eq("id", id).maybeSingle();
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

    async confirmAnamnesis(id, date) {
      const { data, error } = await supabase
        .from("clients")
        .update({ anamnesis_confirmed_at: date })
        .eq("id", id)
        .select("id");
      if (error) throw error;
      return data.length > 0;
    },
  };
}
