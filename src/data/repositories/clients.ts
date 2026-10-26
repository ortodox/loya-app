import type { Client, ClientInput, IsoDate } from "@/logic/client";

/** Client storage interface; Supabase implementation in ./clients-supabase, faked in tests. */
export interface ClientRepository {
  list(): Promise<Client[]>;
  get(id: string): Promise<Client | null>;
  create(input: ClientInput): Promise<{ id: string }>;
  update(id: string, input: ClientInput): Promise<boolean>;
  /** AN3: «Анамнез без изменений ✓» – only this date changes. */
  confirmAnamnesis(id: string, date: IsoDate): Promise<boolean>;
}
