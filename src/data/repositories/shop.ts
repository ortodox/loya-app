import type { IsoDate } from "@/logic/client";
import type { ShopMovement, ShopProduct } from "@/logic/rules/shop";

export type ShopProductInput = Pick<ShopProduct, "brand" | "category" | "name" | "size" | "currency" | "price" | "favorite" | "active">;
export type ShopMovementInput = Omit<ShopMovement, "id" | "createdAt">;

/** MG1–MG4 «Магазин»; Supabase implementation in ./shop-supabase, faked in tests. */
export interface ShopRepository {
  listProducts(): Promise<ShopProduct[]>;
  getProduct(id: string): Promise<ShopProduct | null>;
  createProduct(input: ShopProductInput): Promise<{ id: string }>;
  updateProduct(id: string, input: ShopProductInput): Promise<boolean>;
  setFavorite(id: string, favorite: boolean): Promise<boolean>;
  listMovements(): Promise<ShopMovement[]>;
  addMovement(input: ShopMovementInput): Promise<void>;
  /** MG2: «Удалить» a line of «История» – all movements of that kind on that day. */
  deleteMovements(productId: string, date: IsoDate, kind: ShopMovement["kind"]): Promise<number>;
}
