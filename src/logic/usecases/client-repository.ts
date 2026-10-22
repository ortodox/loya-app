import type { Client, ClientInput } from "@/logic/client";

/** Port for client storage; implemented in src/data, faked in tests. */
export interface ClientRepository {
  list(): Promise<Client[]>;
  get(id: string): Promise<Client | null>;
  create(input: ClientInput): Promise<{ id: string }>;
  update(id: string, input: ClientInput): Promise<boolean>;
}
