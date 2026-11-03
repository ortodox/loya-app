/** EX1: when the doctor saved an archive with «Скачать архив»; Supabase implementation in ./archive-log-supabase. */
export interface ArchiveLogRepository {
  /** The newest time (ISO), or null when no archive has been made. */
  lastDownload(): Promise<string | null>;
  recordDownload(): Promise<void>;
}
