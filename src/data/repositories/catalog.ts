import type { Preparation, PreparationInput, ProcedureType, ProcedureTypeInput, Zone } from "@/logic/catalog";

/** Thrown when a name is already used (a preparation with the same name in the same type). */
export class DuplicateNameError extends Error {}

/** Catalogue storage interface; Supabase implementation in ./catalog-supabase, faked in tests. */
export interface CatalogRepository {
  listZones(): Promise<Zone[]>;
  listTypes(): Promise<ProcedureType[]>;
  getType(id: string): Promise<ProcedureType | null>;
  createType(input: ProcedureTypeInput): Promise<{ id: string }>;
  updateType(id: string, input: ProcedureTypeInput): Promise<boolean>;
  listPreparations(): Promise<Preparation[]>;
  getPreparation(id: string): Promise<Preparation | null>;
  createPreparation(input: PreparationInput): Promise<{ id: string }>;
  updatePreparation(id: string, input: PreparationInput): Promise<boolean>;
}
