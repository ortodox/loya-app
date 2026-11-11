import type { SupabaseClient } from "@supabase/supabase-js";
import type { ShopMovement, ShopProduct } from "@/logic/rules/shop";
import type { ShopProductInput, ShopRepository } from "./shop";

type ProductRow = {
  id: string;
  brand: string;
  category: string;
  name: string;
  size: string;
  currency: "PLN" | "EUR";
  price: number | string;
  favorite: boolean;
  active: boolean;
  sort_order: number;
};
type MovementRow = {
  id: string;
  product_id: string;
  happened_on: string;
  kind: "sale" | "receipt" | "correction";
  quantity: number;
  price: number | string | null;
  currency: "PLN" | "EUR" | null;
  created_at: string;
  order_item_id: string | null;
  returned_on: string | null;
  returned_at: string | null;
};

const productColumns = "id, brand, category, name, size, currency, price, favorite, active, sort_order";
const toProduct = (r: ProductRow): ShopProduct => ({
  id: r.id,
  brand: r.brand,
  category: r.category,
  name: r.name,
  size: r.size,
  currency: r.currency,
  price: Number(r.price),
  favorite: r.favorite,
  active: r.active,
  sortOrder: r.sort_order,
});
const toRow = (i: ShopProductInput) => ({
  brand: i.brand,
  category: i.category,
  name: i.name,
  size: i.size,
  currency: i.currency,
  price: i.price,
  favorite: i.favorite,
  active: i.active,
});

/** Supabase-backed «Магазин». RLS limits every query to the signed-in doctor. */
export function supabaseShopRepository(supabase: SupabaseClient): ShopRepository {
  return {
    async listProducts() {
      const { data, error } = await supabase.from("shop_products").select(productColumns);
      if (error) throw error;
      return (data as ProductRow[]).map(toProduct);
    },

    async getProduct(id) {
      const { data, error } = await supabase.from("shop_products").select(productColumns).eq("id", id).maybeSingle();
      if (error) throw error;
      return data ? toProduct(data as ProductRow) : null;
    },

    async createProduct(input) {
      // New products go after the price lists.
      const { data: last } = await supabase.from("shop_products").select("sort_order").order("sort_order", { ascending: false }).limit(1);
      const sortOrder = ((last?.[0]?.sort_order as number | undefined) ?? 0) + 10;
      const { data, error } = await supabase.from("shop_products").insert({ ...toRow(input), sort_order: sortOrder }).select("id").single();
      if (error) throw error;
      return { id: data.id as string };
    },

    async updateProduct(id, input) {
      const { data, error } = await supabase.from("shop_products").update(toRow(input)).eq("id", id).select("id");
      if (error) throw error;
      return data.length > 0;
    },

    async setFavorite(id, favorite) {
      const { data, error } = await supabase.from("shop_products").update({ favorite }).eq("id", id).select("id");
      if (error) throw error;
      return data.length > 0;
    },

    async listMovements() {
      const { data, error } = await supabase.from("shop_movements").select("id, product_id, happened_on, kind, quantity, price, currency, created_at, order_item_id, returned_on, returned_at");
      if (error) throw error;
      return (data as MovementRow[]).map(
        (m): ShopMovement => ({
          id: m.id,
          productId: m.product_id,
          happenedOn: m.happened_on,
          kind: m.kind,
          quantity: m.quantity,
          price: m.price === null ? null : Number(m.price),
          currency: m.currency,
          createdAt: m.created_at,
          orderItemId: m.order_item_id,
          returnedOn: m.returned_on,
          returnedAt: m.returned_at,
        }),
      );
    },

    async addMovement(input) {
      const { data, error } = await supabase
        .from("shop_movements")
        .insert({
          product_id: input.productId,
          happened_on: input.happenedOn,
          kind: input.kind,
          quantity: input.quantity,
          price: input.price,
          currency: input.currency,
        })
        .select("id")
        .single();
      if (error) throw error;
      return { id: data.id as string };
    },

    async deleteMovement(id) {
      const { data, error } = await supabase.from("shop_movements").delete().eq("id", id).is("order_item_id", null).select("id");
      if (error) throw error;
      return data.length > 0;
    },

    async markReturned(movementId, on) {
      const { data, error } = await supabase
        .from("shop_movements")
        .update({ returned_on: on, returned_at: new Date().toISOString() })
        .eq("id", movementId)
        .is("returned_on", null)
        .is("order_item_id", null)
        .select("id");
      if (error) throw error;
      return data.length > 0;
    },

    async deleteMovements(productId, date, kind) {
      const { data, error } = await supabase.from("shop_movements").delete().eq("product_id", productId).eq("happened_on", date).eq("kind", kind).is("order_item_id", null).select("id");
      if (error) throw error;
      return data.length;
    },
  };
}
