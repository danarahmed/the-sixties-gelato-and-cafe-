import "server-only";
import { db, num, rows, str, strOrNull, type Row } from "@/lib/db/client";

export interface MenuCategory {
  id: string;
  name: string;
  nameAr: string | null;
  nameCkb: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface MenuVariant {
  id: string;
  name: string;
  isActive: boolean;
  /** Sold as bought (a bottle of water): no recipe of its own. */
  soldAsBought: boolean;
  /** Why it uses no stock (a service charge, say); null if it should (0025). */
  noStockReason: string | null;
}

/** A product as the menu is set up: on the till or hidden from it. */
export interface MenuProduct {
  id: string;
  name: string;
  nameAr: string | null;
  nameCkb: string | null;
  categoryId: string | null;
  imageUrl: string | null;
  isActive: boolean;
  isFavourite: boolean;
  variants: MenuVariant[];
}

/** Categories and every product, hidden ones included, so they can be shown again. */
export async function getMenuSetup(): Promise<{
  categories: MenuCategory[];
  products: MenuProduct[];
}> {
  const c = await db();
  const [cats, prods, vars] = await Promise.all([
    c
      .from("product_category")
      .select("id,name,name_ar,name_ckb,sort_order,is_active")
      .order("sort_order")
      .order("name"),
    c
      .from("product")
      .select("id,name,name_ar,name_ckb,category_id,image_url,is_active,is_favourite")
      .order("name"),
    c
      .from("product_variant")
      .select("id,product_id,name,is_active,resale_item_id,no_stock_reason")
      .order("name"),
  ]);
  const variants = new Map<string, MenuVariant[]>();
  for (const v of rows(vars, "product variants")) {
    const list = variants.get(str(v.product_id)) ?? [];
    list.push({
      id: str(v.id),
      name: str(v.name),
      isActive: v.is_active === true,
      soldAsBought: v.resale_item_id != null,
      noStockReason: strOrNull(v.no_stock_reason),
    });
    variants.set(str(v.product_id), list);
  }
  return {
    categories: rows(cats, "categories").map((r: Row) => ({
      id: str(r.id),
      name: str(r.name),
      nameAr: strOrNull(r.name_ar),
      nameCkb: strOrNull(r.name_ckb),
      sortOrder: num(r.sort_order),
      isActive: r.is_active === true,
    })),
    products: rows(prods, "products").map((r: Row) => ({
      id: str(r.id),
      name: str(r.name),
      nameAr: strOrNull(r.name_ar),
      nameCkb: strOrNull(r.name_ckb),
      categoryId: strOrNull(r.category_id),
      imageUrl: strOrNull(r.image_url),
      isActive: r.is_active === true,
      isFavourite: r.is_favourite === true,
      variants: variants.get(str(r.id)) ?? [],
    })),
  };
}
