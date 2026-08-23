/**
 * Live-database inventory read. Selects the `stock_board` view (current stock
 * derived from the append-only ledger, joined with item metadata). Returns null
 * when the DB is not configured so callers can fall back to demo data.
 */
import { getSupabase, DEMO_BUSINESS_ID } from "@/lib/supabase/client";

export interface DbStockRow {
  itemId: string;
  name: string;
  itemType: string;
  unit: string;
  onHandBase: number;
  value: number;
  unitCost: number;
  reorderBase: number | null;
  isLow: boolean;
}

export async function fetchStockBoard(): Promise<DbStockRow[] | null> {
  const client = getSupabase();
  if (!client) return null;

  const { data, error } = await client
    .from("stock_board")
    .select(
      "item_id,name,item_type,base_unit_code,quantity_base,value,unit_cost,min_level_base,is_low",
    )
    .eq("business_id", DEMO_BUSINESS_ID)
    .order("name");

  if (error) throw new Error(`stock_board query failed: ${error.message}`);
  if (!data) return [];

  return data.map((r) => ({
    itemId: String(r.item_id),
    name: String(r.name),
    itemType: String(r.item_type),
    unit: String(r.base_unit_code),
    onHandBase: Number(r.quantity_base),
    value: Number(r.value),
    unitCost: Number(r.unit_cost),
    reorderBase: r.min_level_base === null ? null : Number(r.min_level_base),
    isLow: Boolean(r.is_low),
  }));
}

const TYPE_LABEL: Record<string, string> = {
  ingredient: "Ingredient",
  packaging: "Packaging",
  consumable: "Consumable",
  finished_good: "Finished good",
  resale: "Resale",
  sub_recipe_output: "Sub-recipe",
};

export function itemTypeLabel(t: string): string {
  return TYPE_LABEL[t] ?? t;
}
