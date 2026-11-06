import type { IsoDate } from "@/logic/client";
import type { ReminderType } from "@/logic/rules/reminders";
import type { StockAdjustment, StockReceipt } from "@/logic/rules/stock";

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
};

export type StockReceiptInput = Omit<StockReceipt, "id" | "createdAt"> & { lot: string | null; expiresOn: IsoDate | null };

/** SK1 «Склад»; Supabase implementation in ./stock-supabase, faked in tests. */
export interface StockRepository {
  listItems(): Promise<StockItem[]>;
  addItem(preparationId: string, startedOn: IsoDate, vialSizes: number[] | null): Promise<{ id: string }>;
  addReceipt(itemId: string, input: StockReceiptInput): Promise<void>;
  addAdjustments(itemId: string, adjustments: Omit<StockAdjustment, "createdAt">[]): Promise<void>;
}
