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
  /** Its name in Arabic and Kurdish (0041). */
  nameAr: string | null;
  nameCkb: string | null;
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
      .select("id,product_id,name,name_ar,name_ckb,is_active,resale_item_id,no_stock_reason")
      .order("name"),
  ]);
  const variants = new Map<string, MenuVariant[]>();
  for (const v of rows(vars, "product variants")) {
    const list = variants.get(str(v.product_id)) ?? [];
    list.push({
      id: str(v.id),
      name: str(v.name),
      nameAr: strOrNull(v.name_ar),
      nameCkb: strOrNull(v.name_ckb),
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

// ------------------------------------------------------------------ add-ons (0041)
/** What an add-on uses: for every size (no size), or a size's own quantities. */
export interface AddonRecipeLine {
  variantId: string | null;
  itemId: string;
  /** The item's name, out of use or not. */
  itemName: string;
  quantity: number;
  unitCode: string;
  channels: string[] | null;
}

export interface MenuAddon {
  id: string;
  groupId: string;
  name: string;
  nameAr: string | null;
  nameCkb: string | null;
  sortOrder: number;
  isActive: boolean;
  /** The price in force today on each channel it sells on. */
  prices: Record<string, number>;
  /** Prices set to start on a later day. */
  scheduled: { channel: string; price: number; effectiveFrom: string }[];
  recipe: AddonRecipeLine[];
}

export interface MenuAddonGroup {
  id: string;
  name: string;
  nameAr: string | null;
  nameCkb: string | null;
  /** The fewest and the most a line takes from it. */
  min: number;
  max: number | null;
  sortOrder: number;
  isActive: boolean;
  addons: MenuAddon[];
}

/** A product offering a group, for all its sizes (no size) or one. */
export interface ProductAddonOffer {
  productId: string;
  groupId: string;
  variantId: string | null;
}

/** Every group of add-ons (those taken off the till too), their add-ons, prices, recipes and who offers them. */
export async function getAddonSetup(
  today: string,
): Promise<{ groups: MenuAddonGroup[]; offers: ProductAddonOffer[] }> {
  const c = await db();
  const [groups, mods, prices, lines, offers, itemNames] = await Promise.all([
    c
      .from("modifier_group")
      .select("id,name,name_ar,name_ckb,min_select,max_select,sort_order,is_active")
      .order("sort_order")
      .order("name"),
    c
      .from("modifier")
      .select("id,group_id,name,name_ar,name_ckb,sort_order,is_active")
      .order("sort_order")
      .order("name"),
    c
      .from("modifier_price")
      .select("modifier_id,channel,price,effective_from,created_at")
      .is("location_id", null)
      .order("effective_from")
      .order("created_at"),
    c
      .from("modifier_recipe_line")
      .select("modifier_id,product_variant_id,item_id,quantity,unit_code,applies_to_channels")
      .order("created_at")
      .order("id"),
    c
      .from("product_modifier_group")
      .select("product_id,group_id,product_variant_id,sort_order")
      .order("sort_order"),
    c.from("item").select("id,name"),
  ]);
  const itemName = new Map(rows(itemNames, "items").map((i: Row) => [str(i.id), str(i.name)]));
  const inForce = new Map<string, Record<string, number>>();
  const later = new Map<string, MenuAddon["scheduled"]>();
  for (const p of rows(prices, "add-on prices")) {
    const id = str(p.modifier_id);
    const from = str(p.effective_from);
    if (from <= today) {
      // In date order: the last in force wins.
      const m = inForce.get(id) ?? {};
      m[str(p.channel)] = num(p.price);
      inForce.set(id, m);
    } else {
      later.set(id, [
        ...(later.get(id) ?? []),
        { channel: str(p.channel), price: num(p.price), effectiveFrom: from },
      ]);
    }
  }
  const recipe = new Map<string, AddonRecipeLine[]>();
  for (const l of rows(lines, "add-on recipes")) {
    const id = str(l.modifier_id);
    recipe.set(id, [
      ...(recipe.get(id) ?? []),
      {
        variantId: strOrNull(l.product_variant_id),
        itemId: str(l.item_id),
        itemName: itemName.get(str(l.item_id)) ?? "",
        quantity: num(l.quantity),
        unitCode: str(l.unit_code),
        channels: Array.isArray(l.applies_to_channels)
          ? (l.applies_to_channels as unknown[]).map(String)
          : null,
      },
    ]);
  }
  const addons = rows(mods, "add-ons").map((m: Row) => ({
    id: str(m.id),
    groupId: str(m.group_id),
    name: str(m.name),
    nameAr: strOrNull(m.name_ar),
    nameCkb: strOrNull(m.name_ckb),
    sortOrder: num(m.sort_order),
    isActive: m.is_active === true,
    prices: inForce.get(str(m.id)) ?? {},
    scheduled: later.get(str(m.id)) ?? [],
    recipe: recipe.get(str(m.id)) ?? [],
  }));
  return {
    groups: rows(groups, "groups of add-ons").map((g: Row) => ({
      id: str(g.id),
      name: str(g.name),
      nameAr: strOrNull(g.name_ar),
      nameCkb: strOrNull(g.name_ckb),
      min: num(g.min_select),
      max: g.max_select === null || g.max_select === undefined ? null : num(g.max_select),
      sortOrder: num(g.sort_order),
      isActive: g.is_active === true,
      addons: addons.filter((a) => a.groupId === str(g.id)),
    })),
    offers: rows(offers, "products' add-ons").map((o: Row) => ({
      productId: str(o.product_id),
      groupId: str(o.group_id),
      variantId: strOrNull(o.product_variant_id),
    })),
  };
}
