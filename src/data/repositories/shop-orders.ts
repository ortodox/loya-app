import type { IsoDate } from "@/logic/client";
import type { ShopBuyer, ShopOrder } from "@/logic/rules/shop-orders";

/** MG9: what is saved for one order (buyer, lines in zł, the € rate used). */
export type ShopOrderInput = {
  buyerId: string | null;
  buyerName: string;
  buyerPhone: string;
  buyerInstagram: string;
  orderedOn: IsoDate;
  eurRate: number | null;
  rateSource: "nbp" | "own" | null;
  items: { productId: string; quantity: number; price: number; missing: number }[];
};

export type ShopSettings = { ownEurRate: number | null; nbpEurRate: number | null; nbpRateDate: IsoDate | null };

/** MG9–MG12 orders and buyers in «Магазин»; Supabase implementation in ./shop-orders-supabase. */
export interface ShopOrdersRepository {
  listBuyers(): Promise<ShopBuyer[]>;
  listOrders(): Promise<ShopOrder[]>;
  getOrder(id: string): Promise<ShopOrder | null>;
  /** Saves buyer, order and lines (with their sales) in one go; an order handed over is not changed. */
  saveOrder(id: string | null, input: ShopOrderInput): Promise<{ id: string }>;
  setHandedOver(id: string, on: IsoDate | null): Promise<boolean>;
  /** «Отменить заказ»: removes the order, its lines and their sales. */
  deleteOrder(id: string): Promise<boolean>;
  /** MG10: one delivered piece goes to this order line (delivery +1 and the order's sale +1, missing −1). */
  giveReceiptToOrder(orderItemId: string, on: IsoDate): Promise<boolean>;
  /** MG11 «Оплата». */
  addPayment(orderId: string, amount: number, on: IsoDate): Promise<void>;
  deletePayment(paymentId: string): Promise<boolean>;
  getSettings(): Promise<ShopSettings>;
  saveNbpRate(rate: number, date: IsoDate): Promise<void>;
  setOwnRate(rate: number | null): Promise<void>;
}
