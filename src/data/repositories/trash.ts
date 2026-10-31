/** PR6: a client in «Удалённые клиенты». */
export type DeletedClient = { id: string; fullName: string; deletedAt: string };

/** PR6 «Удалённые клиенты»; Supabase implementation in ./trash-supabase, faked in tests. */
export interface ClientTrashRepository {
  /** False when the client does not exist or is already deleted. */
  moveToTrash(id: string, at: string): Promise<boolean>;
  restore(id: string): Promise<boolean>;
  listDeleted(): Promise<DeletedClient[]>;
  /** Every stored file of the client: photos in «visit-photos», documents in «client-documents». */
  filesOf(id: string): Promise<{ photos: string[]; documents: string[] }>;
  /** Deletes a client from the trash for good; its rows go with it (on delete cascade). */
  purge(id: string): Promise<boolean>;
}
