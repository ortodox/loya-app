import type { IsoDate } from "@/logic/client";
import type { ReminderType } from "@/logic/rules/reminders";
import type { StockAdjustment, StockReceipt } from "@/logic/rules/stock";
import type { StockChange } from "@/logic/rules/stock-changes";

/** SK1: a preparation kept in stock, with its receipts and corrections. */
export type StockItem = {
  id: string;
  preparationId: string;
  preparationName: string;
  type: ReminderType | null;
  startedOn: IsoDate;
  /** Botox vial sizes; null = counted in pieces. */
  vialSizes: number[] | null;
  receipts: StockReceipt[];
  adjustments: StockAdjustment[];
  /** SK4: the change log, oldest first. */
  changes: StockChange[];
  /** SK8: lines removed from «История» (visits, receipts, corrections). */
  hiddenKeys: string[];
};

export type StockReceiptInput = Omit<StockReceipt, "id" | "createdAt"> & { lot: string | null; expiresOn: IsoDate | null };

/** SK1 «Склад»; Supabase implementation in ./stock-supabase, faked in tests. */
export interface StockRepository {
  listItems(): Promise<StockItem[]>;
  addItem(preparationId: string, startedOn: IsoDate, vialSizes: number[] | null): Promise<{ id: string }>;
  addReceipt(itemId: string, input: StockReceiptInput): Promise<void>;
  addAdjustments(itemId: string, adjustments: Omit<StockAdjustment, "createdAt">[]): Promise<void>;
  /** SK8: deletes change-log rows of this preparation for good. */
  deleteChanges(preparationId: string, ids: string[]): Promise<number>;
  /** SK8: takes a line made from a visit, receipt or correction out of «История» for good. */
  hideHistoryLine(itemId: string, key: string): Promise<void>;
  /** SK7: names of the clients in «История» (also deleted ones, marked). */
  clientNames(ids: string[]): Promise<Record<string, { name: string; deleted: boolean }>>;
  /** SK1 ✏️ B: a new vial size added when a receipt comes in. */
  setVialSizes(itemId: string, sizes: number[]): Promise<void>;
}
