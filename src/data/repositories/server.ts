import { createClient } from "@/data/supabase/server";
import { supabaseClientRepository } from "./clients-supabase";
import { supabaseVisitRepository } from "./visits-supabase";

/** Repositories for server components and server actions, bound to the signed-in doctor. */
export async function clientRepository() {
  return supabaseClientRepository(await createClient());
}

export async function visitRepository() {
  return supabaseVisitRepository(await createClient());
}
