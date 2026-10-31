import { createClient } from "@/data/supabase/server";
import { supabaseCatalogRepository } from "./catalog-supabase";
import { supabaseCareRepository } from "./care-supabase";
import { supabaseClientPhotoRepository } from "./client-photos-supabase";
import { supabaseClientRepository } from "./clients-supabase";
import { supabaseCourseRepository } from "./courses-supabase";
import { supabaseDocumentRepository, supabaseDocumentStorage } from "./documents-supabase";
import { supabasePhotoStorage } from "./photos-supabase";
import { supabaseClientTrashRepository } from "./trash-supabase";
import { supabaseVisitRepository } from "./visits-supabase";

/** Repositories for server components and server actions, bound to the signed-in doctor. */
export async function clientRepository() {
  return supabaseClientRepository(await createClient());
}

export async function visitRepository() {
  return supabaseVisitRepository(await createClient());
}

export async function catalogRepository() {
  return supabaseCatalogRepository(await createClient());
}

export async function courseRepository() {
  return supabaseCourseRepository(await createClient());
}

export async function photoStorage() {
  return supabasePhotoStorage(await createClient());
}

export async function careRepository() {
  return supabaseCareRepository(await createClient());
}

export async function documentRepository() {
  return supabaseDocumentRepository(await createClient());
}

export async function documentStorage() {
  return supabaseDocumentStorage(await createClient());
}

export async function clientPhotoRepository() {
  return supabaseClientPhotoRepository(await createClient());
}

export async function clientTrashRepository() {
  return supabaseClientTrashRepository(await createClient());
}
