/**
 * Live catalog + costing read layer.
 *
 * Loads products, variants, channel prices and recipes from the database and
 * costs them with the REAL tested domain core (unit conversion, channel-aware
 * recipe expansion, moving-average cost derived from the live ledger). Used by
 * the POS, Products and Reports screens. Returns plain, serialisable numbers so
 * the results can cross the server→client boundary.
 */
import Decimal from "decimal.js";
import { IQD, Money } from "@domain/money/money.js";
import { UnitSystem, type UnitDefinition, type Dimension } from "@domain/units/units.js";
import {
  expandRecipeForSale,
  recipeServingCost,
  type Recipe,
  type RecipeLine,
  type SalesChannel,
} from "@domain/sales/recipe.js";
import { averageUnitCost, type WacState } from "@domain/costing/wac.js";
import { getSupabase, DEMO_BUSINESS_ID } from "@/lib/supabase/client";

export const SELLABLE_CHANNELS: SalesChannel[] = [
  "dine_in",
  "takeaway",
  "direct_delivery",
  "talabat",
];

export interface ItemCost {
  id: string;
  name: string;
  baseUnit: string;
  dimension: Dimension;
  units: UnitDefinition[];
  wac: WacState;
}

export interface SellableVariant {
  variantId: string;
  productId: string;
  productName: string;
  variantName: string;
  categoryName: string | null;
  recipeId: string | null;
  priceByChannel: Partial<Record<SalesChannel, number>>;
  cogsByChannel: Partial<Record<SalesChannel, number>>;
}

export interface LoadedCatalog {
  items: Map<string, ItemCost>;
  recipes: Map<string, Recipe>;
  variants: SellableVariant[];
  getUnitSystem: (itemId: string) => UnitSystem;
  wacByItem: Map<string, WacState>;
}

/** Build a UnitSystem for an item from its base unit + alternate units. */
function unitSystemFor(item: ItemCost): UnitSystem {
  const base: UnitDefinition = {
    code: item.baseUnit,
    dimension: item.dimension,
    factorToBase: "1",
    label: item.baseUnit,
  };
  const others = item.units.filter((u) => u.code !== item.baseUnit);
  return new UnitSystem(item.baseUnit, [base, ...others]);
}

/** Pick the recipe version in force (latest version_no) and shape its lines. */
function shapeRecipe(
  recipeId: string,
  versionRows: { id: string; version_no: number }[],
  lineRows: RawRecipeLine[],
): Recipe | null {
  const current = versionRows
    .filter((v) => v)
    .sort((a, b) => b.version_no - a.version_no)[0];
  if (!current) return null;
  const lines: RecipeLine[] = lineRows
    .filter((l) => l.recipe_version_id === current.id)
    .map((l) => ({
      componentType: l.component_type,
      componentId: l.component_type === "item" ? String(l.item_id) : String(l.sub_recipe_id),
      quantity: String(l.quantity),
      unitCode: l.unit_code,
      appliesToChannels: (l.applies_to_channels ?? undefined) as SalesChannel[] | undefined,
    }));
  return { id: recipeId, lines };
}

interface RawRecipeLine {
  recipe_version_id: string;
  component_type: "item" | "sub_recipe";
  item_id: string | null;
  sub_recipe_id: string | null;
  quantity: number | string;
  unit_code: string;
  applies_to_channels: string[] | null;
}

/** Load the full catalog and cost every variant across the sellable channels. */
export async function loadCatalog(): Promise<LoadedCatalog | null> {
  const db = getSupabase();
  if (!db) return null;
  const biz = DEMO_BUSINESS_ID;

  const [itemsR, unitsR, boardR, productsR, variantsR, pricesR, vrR, versionsR, linesR, catsR] =
    await Promise.all([
      db.from("item").select("id,name,base_unit_code,dimension").eq("business_id", biz),
      db.from("item_unit").select("item_id,code,label,dimension,factor_to_base"),
      db.from("stock_board").select("item_id,quantity_base,value").eq("business_id", biz),
      db
        .from("product")
        .select("id,name,category_id,is_active")
        .eq("business_id", biz)
        .eq("is_active", true),
      db.from("product_variant").select("id,product_id,name,is_active"),
      db.from("channel_price").select("product_variant_id,channel,price,effective_from").eq("business_id", biz),
      db.from("variant_recipe").select("product_variant_id,recipe_id"),
      db.from("recipe_version").select("id,recipe_id,version_no"),
      db
        .from("recipe_line")
        .select("recipe_version_id,component_type,item_id,sub_recipe_id,quantity,unit_code,applies_to_channels"),
      db.from("product_category").select("id,name").eq("business_id", biz),
    ]);

  const firstErr = [itemsR, unitsR, boardR, productsR, variantsR, pricesR, vrR, versionsR, linesR, catsR].find(
    (r) => r.error,
  );
  if (firstErr?.error) throw new Error(`catalog load failed: ${firstErr.error.message}`);

  // Items with WAC derived from the live ledger (stock_board).
  const boardByItem = new Map<string, { qty: number; value: number }>();
  for (const b of boardR.data ?? [])
    boardByItem.set(String(b.item_id), { qty: Number(b.quantity_base), value: Number(b.value) });

  const unitsByItem = new Map<string, UnitDefinition[]>();
  for (const u of unitsR.data ?? []) {
    const list = unitsByItem.get(String(u.item_id)) ?? [];
    list.push({
      code: String(u.code),
      dimension: String(u.dimension) as Dimension,
      factorToBase: String(u.factor_to_base),
      label: String(u.label),
    });
    unitsByItem.set(String(u.item_id), list);
  }

  const items = new Map<string, ItemCost>();
  const wacByItem = new Map<string, WacState>();
  for (const it of itemsR.data ?? []) {
    const id = String(it.id);
    const board = boardByItem.get(id);
    const wac: WacState = {
      quantityBase: new Decimal(board?.qty ?? 0),
      totalValue: Money.of(board?.value ?? 0, IQD),
    };
    items.set(id, {
      id,
      name: String(it.name),
      baseUnit: String(it.base_unit_code),
      dimension: String(it.dimension) as Dimension,
      units: unitsByItem.get(id) ?? [],
      wac,
    });
    wacByItem.set(id, wac);
  }

  const getUnitSystem = (itemId: string): UnitSystem => {
    const it = items.get(itemId);
    if (!it) throw new Error(`Unknown item ${itemId}`);
    return unitSystemFor(it);
  };

  // Recipes keyed by recipe id (current version's lines).
  const versionsByRecipe = new Map<string, { id: string; version_no: number }[]>();
  for (const v of versionsR.data ?? []) {
    const list = versionsByRecipe.get(String(v.recipe_id)) ?? [];
    list.push({ id: String(v.id), version_no: Number(v.version_no) });
    versionsByRecipe.set(String(v.recipe_id), list);
  }
  const recipes = new Map<string, Recipe>();
  for (const [recipeId, versions] of versionsByRecipe) {
    const shaped = shapeRecipe(recipeId, versions, (linesR.data ?? []) as RawRecipeLine[]);
    if (shaped) recipes.set(recipeId, shaped);
  }

  const catName = new Map<string, string>();
  for (const c of catsR.data ?? []) catName.set(String(c.id), String(c.name));
  const productById = new Map<string, { name: string; categoryId: string | null }>();
  for (const p of productsR.data ?? [])
    productById.set(String(p.id), {
      name: String(p.name),
      categoryId: p.category_id ? String(p.category_id) : null,
    });

  const recipeByVariant = new Map<string, string>();
  for (const vr of vrR.data ?? []) recipeByVariant.set(String(vr.product_variant_id), String(vr.recipe_id));

  // Latest price per (variant, channel).
  const priceMap = new Map<string, Map<SalesChannel, { price: number; from: string }>>();
  for (const pr of pricesR.data ?? []) {
    const vid = String(pr.product_variant_id);
    const ch = String(pr.channel) as SalesChannel;
    const inner = priceMap.get(vid) ?? new Map();
    const existing = inner.get(ch);
    const from = String(pr.effective_from ?? "");
    if (!existing || from >= existing.from) inner.set(ch, { price: Number(pr.price), from });
    priceMap.set(vid, inner);
  }

  const ctx = { getRecipe: (id: string) => recipes.get(id)!, getUnitSystem };

  const variants: SellableVariant[] = [];
  for (const v of variantsR.data ?? []) {
    if (v.is_active === false) continue;
    const productId = String(v.product_id);
    const product = productById.get(productId);
    if (!product) continue; // inactive/absent product
    const variantId = String(v.id);
    const recipeId = recipeByVariant.get(variantId) ?? null;
    const priceByChannel: Partial<Record<SalesChannel, number>> = {};
    const cogsByChannel: Partial<Record<SalesChannel, number>> = {};
    const inner = priceMap.get(variantId);
    for (const ch of SELLABLE_CHANNELS) {
      if (inner?.has(ch)) priceByChannel[ch] = inner.get(ch)!.price;
      if (recipeId && recipes.get(recipeId)) {
        try {
          const cost = recipeServingCost(recipes.get(recipeId)!, ch, ctx, wacByItem, IQD);
          cogsByChannel[ch] = Number(cost.quantize().toDecimalValue().toString());
        } catch {
          // missing item/unit — leave undefined
        }
      }
    }
    variants.push({
      variantId,
      productId,
      productName: product.name,
      variantName: String(v.name),
      categoryName: product.categoryId ? catName.get(product.categoryId) ?? null : null,
      recipeId,
      priceByChannel,
      cogsByChannel,
    });
  }
  variants.sort((a, b) => a.productName.localeCompare(b.productName));

  return { items, recipes, variants, getUnitSystem, wacByItem };
}

/** Expand a recipe for a sale — used by the record-sale action for real deductions. */
export function expandForSale(
  cat: LoadedCatalog,
  recipeId: string,
  channel: SalesChannel,
  servings: number,
) {
  const recipe = cat.recipes.get(recipeId);
  if (!recipe) return [];
  const ctx = { getRecipe: (id: string) => cat.recipes.get(id)!, getUnitSystem: cat.getUnitSystem };
  return expandRecipeForSale(recipe, channel, servings, ctx).map((d) => {
    const wac = cat.wacByItem.get(d.itemId);
    const unit = wac ? averageUnitCost(wac) : Money.zero(IQD);
    return { itemId: d.itemId, baseQuantity: d.baseQuantity, unitCost: unit };
  });
}
