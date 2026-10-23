import type { Visit, VisitInput } from "@/logic/client";

/** Visit storage interface; Supabase implementation in ./visits-supabase, faked in tests. */
export interface VisitRepository {
  listByClient(clientId: string): Promise<Visit[]>;
  get(id: string): Promise<Visit | null>;
  create(clientId: string, input: VisitInput): Promise<{ id: string }>;
  update(id: string, input: VisitInput): Promise<boolean>;
  delete(id: string): Promise<boolean>;
}
