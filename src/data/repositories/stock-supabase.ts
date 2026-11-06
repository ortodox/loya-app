import type { SupabaseClient } from "@supabase/supabase-js";
import type { Localized } from "@/logic/catalog";
import type { StockItem, StockRepository } from "./stock";

type TypeRow = { id: string; code: string | null; name: Localized | null };
type Row = {
  id: string;
  preparation_id: string;
  started_on: string;
  vial_sizes: number[] | null;
  preparations: { name: string; procedure_types: TypeRow | TypeRow[] | null } | { name: string; procedure_types: TypeRow | TypeRow[] | null }[] | null;
  stock_receipts: { id: string; received_on: string; vial_size: number | null; count: number; opened_on: string | null; remaining: number | string | null; created_at: string }[];
  stock_adjustments: { happened_on: string; kind: "discard" | "set"; vial_key: string | null; amount: number | string | null; created_at: string }[];
};

const one = <T>(x: T | T[] | null): T | null => (Array.isArray(x) ? x[0] ?? null : x);
const num = (x: number | string | null) => (x === null ? null : Number(x));

/** Supabase-backed «Склад». RLS limits every query to the signed-in doctor. */
export function supabaseStockRepository(supabase: SupabaseClient): StockRepository {
  return {
    async listItems() {
      const { data, error } = await supabase
        .from("stock_items")
        .select(
          "id, preparation_id, started_on, vial_sizes, preparations(name, procedure_types(id, code, name)), " +
            "stock_receipts(id, received_on, vial_size, count, opened_on, remaining, created_at), " +
            "stock_adjustments(happened_on, kind, vial_key, amount, created_at)",
        );
      if (error) throw error;
      return (data as unknown as Row[]).map((r): StockItem => {
        const preparation = one(r.preparations);
        const type = one(preparation?.procedure_types ?? null);
        return {
          id: r.id,
          preparationId: r.preparation_id,
          preparationName: preparation?.name ?? "—",
          type: type ? { id: type.id, code: type.code, name: type.name ?? {} } : null,
          startedOn: r.started_on,
          vialSizes: r.vial_sizes,
          receipts: r.stock_receipts.map((x) => ({
            id: x.id,
            receivedOn: x.received_on,
            vialSize: x.vial_size,
            count: x.count,
            openedOn: x.opened_on,
            remaining: num(x.remaining),
            createdAt: x.created_at,
          })),
          adjustments: r.stock_adjustments.map((x) => ({ happenedOn: x.happened_on, kind: x.kind, vialKey: x.vial_key, amount: num(x.amount), createdAt: x.created_at })),
        };
      });
    },

    async addItem(preparationId, startedOn, vialSizes) {
      const { data, error } = await supabase.from("stock_items").insert({ preparation_id: preparationId, started_on: startedOn, vial_sizes: vialSizes }).select("id").single();
      if (error) throw error;
      return { id: data.id as string };
    },

    async addReceipt(itemId, input) {
      const { error } = await supabase.from("stock_receipts").insert({
        stock_item_id: itemId,
        received_on: input.receivedOn,
        vial_size: input.vialSize,
        count: input.count,
        opened_on: input.openedOn,
        remaining: input.remaining,
        lot: input.lot,
        expires_on: input.expiresOn,
      });
      if (error) throw error;
    },

    async addAdjustments(itemId, adjustments) {
      if (adjustments.length === 0) return;
      const { error } = await supabase
        .from("stock_adjustments")
        .insert(adjustments.map((a) => ({ stock_item_id: itemId, happened_on: a.happenedOn, kind: a.kind, vial_key: a.vialKey, amount: a.amount })));
      if (error) throw error;
    },
  };
}
