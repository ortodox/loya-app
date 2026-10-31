import type { Anamnesis, Client, ClientInput, IsoDate } from "@/logic/client";
import type { Direction } from "@/logic/course";

/** Client storage interface; Supabase implementation in ./clients-supabase, faked in tests. */
export interface ClientRepository {
  list(): Promise<Client[]>;
  get(id: string): Promise<Client | null>;
  create(input: ClientInput): Promise<{ id: string }>;
  update(id: string, input: ClientInput): Promise<boolean>;
  /** AN3: «Анамнез без изменений ✓» – only this date changes. */
  confirmAnamnesis(id: string, date: IsoDate): Promise<boolean>;
  /** DM1: only the direction changes (set to «Дерматология» when a course starts). */
  setDirection(id: string, direction: Direction[]): Promise<boolean>;
  /** AN3: only the anamnesis changes (one section of «Анкета» edited on its own). */
  setAnamnesis(id: string, anamnesis: Anamnesis): Promise<boolean>;
}
