import type { SupabaseClient } from "@supabase/supabase-js";
import type { ShopBuyer, ShopOrder } from "@/logic/rules/shop-orders";
import type { ShopOrdersRepository, ShopSettings } from "./shop-orders";

type OrderRow = {
  id: string;
  buyer_id: string;
  ordered_on: string;
  eur_rate: number | string | null;
  rate_source: "nbp" | "own" | null;
  handed_over_on: string | null;
  created_at: string;
  shop_order_items: { id: string; product_id: string; quantity: number; price: number | string; sort_order: number }[];
};

const orderColumns = "id, buyer_id, ordered_on, eur_rate, rate_source, handed_over_on, created_at, shop_order_items(id, product_id, quantity, price, sort_order)";
const toOrder = (r: OrderRow): ShopOrder => ({
  id: r.id,
  buyerId: r.buyer_id,
  orderedOn: r.ordered_on,
  eurRate: r.eur_rate === null ? null : Number(r.eur_rate),
  rateSource: r.rate_source,
  handedOverOn: r.handed_over_on,
  createdAt: r.created_at,
  items: [...r.shop_order_items]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((i) => ({ id: i.id, productId: i.product_id, quantity: i.quantity, price: Number(i.price) })),
});

/** Supabase-backed orders and buyers. RLS limits every query to the signed-in doctor. */
export function supabaseShopOrdersRepository(supabase: SupabaseClient): ShopOrdersRepository {
  return {
    async listBuyers() {
      const { data, error } = await supabase.from("shop_buyers").select("id, name, phone, instagram").order("name");
      if (error) throw error;
      return data as ShopBuyer[];
    },

    async listOrders() {
      const { data, error } = await supabase.from("shop_orders").select(orderColumns);
      if (error) throw error;
      return (data as OrderRow[]).map(toOrder);
    },

    async getOrder(id) {
      const { data, error } = await supabase.from("shop_orders").select(orderColumns).eq("id", id).maybeSingle();
      if (error) throw error;
      return data ? toOrder(data as OrderRow) : null;
    },

    async saveOrder(id, input) {
      const { data, error } = await supabase.rpc("save_shop_order", {
        p_order_id: id,
        p_buyer_id: input.buyerId,
        p_buyer_name: input.buyerName,
        p_buyer_phone: input.buyerPhone,
        p_buyer_instagram: input.buyerInstagram,
        p_ordered_on: input.orderedOn,
        p_eur_rate: input.eurRate,
        p_rate_source: input.rateSource,
        p_items: input.items.map((i) => ({ product_id: i.productId, quantity: i.quantity, price: i.price })),
      });
      if (error) throw error;
      return { id: data as string };
    },

    async setHandedOver(id, on) {
      const { data, error } = await supabase.from("shop_orders").update({ handed_over_on: on }).eq("id", id).select("id");
      if (error) throw error;
      return data.length > 0;
    },

    async deleteOrder(id) {
      const { data, error } = await supabase.from("shop_orders").delete().eq("id", id).is("handed_over_on", null).select("id");
      if (error) throw error;
      return data.length > 0;
    },

    async getSettings() {
      const { data, error } = await supabase.from("shop_settings").select("own_eur_rate, nbp_eur_rate, nbp_rate_date").maybeSingle();
      if (error) throw error;
      const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
      return {
        ownEurRate: num(data?.own_eur_rate),
        nbpEurRate: num(data?.nbp_eur_rate),
        nbpRateDate: (data?.nbp_rate_date as string | null | undefined) ?? null,
      } satisfies ShopSettings;
    },

    async saveNbpRate(rate, date) {
      const { data: auth } = await supabase.auth.getUser();
      const doctorId = auth.user?.id;
      if (!doctorId) return;
      const { error } = await supabase
        .from("shop_settings")
        .upsert({ doctor_id: doctorId, nbp_eur_rate: rate, nbp_rate_date: date, updated_at: new Date().toISOString() }, { onConflict: "doctor_id" });
      if (error) throw error;
    },

    async setOwnRate(rate) {
      const { data: auth } = await supabase.auth.getUser();
      const doctorId = auth.user?.id;
      if (!doctorId) throw new Error("not signed in");
      const { error } = await supabase
        .from("shop_settings")
        .upsert({ doctor_id: doctorId, own_eur_rate: rate, updated_at: new Date().toISOString() }, { onConflict: "doctor_id" });
      if (error) throw error;
    },
  };
}
