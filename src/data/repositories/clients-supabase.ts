import type { SupabaseClient } from "@supabase/supabase-js";
import type { Anamnesis, Client, ClientInput } from "@/logic/client";
import { parseDirection } from "@/logic/rules/courses";
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
  direction: string[] | null;
  care_text: string | null;
  care_updated_at: string | null;
  updated_at: string;
  visits?: { visit_date: string }[];
  treatment_courses?: { status: "active" | "completed"; start_date: string; end_date: string }[];
  client_photos?: { storage_path: string }[];
};

const columns =
  "id, full_name, card_date, age_at_registration, birth_date, phone, email, residence_country, residence_city, language, anamnesis, notes, procedure_plan, anamnesis_confirmed_at, direction, care_text, care_updated_at, updated_at";

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
    direction: parseDirection(row.direction ?? []),
    careText: row.care_text,
    careUpdatedAt: row.care_updated_at,
    courses: (row.treatment_courses ?? []).map((c) => ({ status: c.status, startDate: c.start_date, endDate: c.end_date })),
    latestPhotoPath: row.client_photos?.[0]?.storage_path ?? null,
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
    direction: input.direction.length > 0 ? input.direction : null,
  };
}

/** Supabase-backed client storage. RLS limits every query to the signed-in doctor. */
export function supabaseClientRepository(supabase: SupabaseClient): ClientRepository {
  // VS1/VP2/LE4: all visit dates and course dates – last visit, next appointment, «На лечении».
  const withVisits = () =>
    // PR6: clients in «Удалённые клиенты» are left out everywhere.
    supabase
      .from("clients")
      .select(`${columns}, visits(visit_date), treatment_courses(status, start_date, end_date), client_photos(storage_path)`)
      .is("deleted_at", null)
      // FK1: only the newest client photo, for the round picture.
      .order("taken_on", { referencedTable: "client_photos", ascending: false })
      .order("created_at", { referencedTable: "client_photos", ascending: false })
      .limit(1, { referencedTable: "client_photos" });

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

    async setDirection(id, direction) {
      const { data, error } = await supabase
        .from("clients")
        .update({ direction: direction.length > 0 ? direction : null })
        .eq("id", id)
        .select("id");
      if (error) throw error;
      return data.length > 0;
    },

    async setAnamnesis(id, anamnesis) {
      const { data, error } = await supabase
        .from("clients")
        .update({ anamnesis })
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
