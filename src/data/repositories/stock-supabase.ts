import type { SupabaseClient } from "@supabase/supabase-js";
import type { Localized } from "@/logic/catalog";
import type { StockChange } from "@/logic/rules/stock-changes";
import type { StockItem, StockRepository } from "./stock";

type TypeRow = { id: string; code: string | null; name: Localized | null };
type Row = {
  id: string;
  preparation_id: string;
  started_on: string;
  vial_sizes: number[] | null;
  preparations: { name: string; procedure_types: TypeRow | TypeRow[] | null } | { name: string; procedure_types: TypeRow | TypeRow[] | null }[] | null;
  stock_receipts: { id: string; received_on: string; vial_size: number | null; count: number; opened_on: string | null; remaining: number | string | null; created_at: string }[];
  stock_history_hidden: { line_key: string }[];
  stock_adjustments: { id: string; happened_on: string; kind: "discard" | "set"; vial_key: string | null; amount: number | string | null; created_at: string }[];
};

type ChangeRow = {
  id: string;
  preparation_id: string;
  changed_at: string;
  source: StockChange["source"];
  action: StockChange["action"];
  visit_id: string | null;
  client_id: string | null;
  visit_date: string | null;
  new_visit_date: string | null;
  old_quantity: string | null;
  new_quantity: string | null;
  old_data: { received_on?: string; happened_on?: string } | null;
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
            "stock_adjustments(id, happened_on, kind, vial_key, amount, created_at), stock_history_hidden(line_key)",
        );
      if (error) throw error;
      const rows = data as unknown as Row[];
      // SK4: the change log of the preparations kept in stock (written by database triggers).
      const changes = await supabase
        .from("stock_changes")
        .select("id, preparation_id, changed_at, source, action, visit_id, client_id, visit_date, new_visit_date, old_quantity, new_quantity, old_data")
        .in("preparation_id", rows.length > 0 ? rows.map((r) => r.preparation_id) : ["00000000-0000-0000-0000-000000000000"])
        .order("changed_at", { ascending: true });
      if (changes.error) throw changes.error;
      const changesOf = new Map<string, StockChange[]>();
      for (const c of changes.data as ChangeRow[]) {
        const list = changesOf.get(c.preparation_id) ?? [];
        list.push({
          id: c.id,
          at: c.changed_at,
          source: c.source,
          action: c.action,
          visitId: c.visit_id,
          clientId: c.client_id,
          visitDate: c.visit_date,
          newVisitDate: c.new_visit_date,
          oldQuantity: c.old_quantity,
          newQuantity: c.new_quantity,
          rowDate: c.old_data?.received_on ?? c.old_data?.happened_on ?? null,
        });
        changesOf.set(c.preparation_id, list);
      }
      return rows.map((r): StockItem => {
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
          adjustments: r.stock_adjustments.map((x) => ({ id: x.id, happenedOn: x.happened_on, kind: x.kind, vialKey: x.vial_key, amount: num(x.amount), createdAt: x.created_at })),
          changes: changesOf.get(r.preparation_id) ?? [],
          hiddenKeys: r.stock_history_hidden.map((h) => h.line_key),
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

    async deleteChanges(preparationId, ids) {
      if (ids.length === 0) return 0;
      const { data, error } = await supabase.from("stock_changes").delete().eq("preparation_id", preparationId).in("id", ids).select("id");
      if (error) throw error;
      return data.length;
    },

    async hideHistoryLine(itemId, key) {
      const { error } = await supabase.from("stock_history_hidden").upsert({ stock_item_id: itemId, line_key: key }, { onConflict: "doctor_id,stock_item_id,line_key", ignoreDuplicates: true });
      if (error) throw error;
    },

    async clientNames(ids) {
      if (ids.length === 0) return {};
      // SK7: straight from «clients» (RLS: own clients only) – deleted ones too, so «История» can mark them.
      const { data, error } = await supabase.from("clients").select("id, full_name, deleted_at").in("id", ids);
      if (error) throw error;
      return Object.fromEntries((data as { id: string; full_name: string; deleted_at: string | null }[]).map((c) => [c.id, { name: c.full_name, deleted: c.deleted_at !== null }]));
    },

    async setVialSizes(itemId, sizes) {
      const { error } = await supabase.from("stock_items").update({ vial_sizes: sizes }).eq("id", itemId);
      if (error) throw error;
    },
  };
}
