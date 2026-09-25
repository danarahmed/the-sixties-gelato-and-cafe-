import "server-only";
/**
 * What the café makes in batches, and the batches made (migration 0023). Both
 * come from database functions that check the person's permission; a batch's
 * cost comes back only to those who may see costs.
 */
import { db, num, numOrNull, rows, str, strOrNull } from "./client";

export interface BatchRecipeLine {
  itemId: string;
  name: string;
  quantity: number;
  unitCode: string;
  /** The quantity in the item's base unit, for one batch. */
  baseQty: number;
}

export interface BatchRecipe {
  id: string;
  name: string;
  outputItemId: string;
  outputName: string;
  /** The made item's base unit (g, ml or each). */
  outputUnit: string;
  /** What one batch makes, in the base unit… */
  yieldBase: number;
  /** …and the unit it was given in (kg, L, pan). */
  yieldUnit: string;
  instructions: string | null;
  isActive: boolean;
  lines: BatchRecipeLine[];
}

export async function getBatchRecipes(): Promise<BatchRecipe[]> {
  const c = await db();
  return rows(await c.rpc("production_recipes"), "batch recipes").map(
    (r: Record<string, unknown>) => ({
      id: str(r.recipe_id),
      name: str(r.name),
      outputItemId: str(r.output_item_id),
      outputName: str(r.output_name),
      outputUnit: str(r.output_unit),
      yieldBase: num(r.yield_base),
      yieldUnit: str(r.yield_unit),
      instructions: strOrNull(r.instructions),
      isActive: Boolean(r.is_active),
      lines: (Array.isArray(r.lines) ? r.lines : []).map((l: Record<string, unknown>) => ({
        itemId: str(l.item_id),
        name: str(l.name),
        quantity: num(l.quantity),
        unitCode: str(l.unit_code),
        baseQty: num(l.base_qty),
      })),
    }),
  );
}

export interface BatchRow {
  id: string;
  recipeId: string;
  recipeName: string;
  outputItemId: string;
  outputName: string;
  outputUnit: string;
  batches: number;
  plannedBase: number;
  actualBase: number;
  /** The unit what came out was given in. */
  enteredUnit: string;
  status: string;
  producedAt: string;
  madeBy: string | null;
  note: string | null;
  cancelledAt: string | null;
  cancelledBy: string | null;
  cancelReason: string | null;
  /** What the ingredients cost; null for those who do not see costs. */
  value: number | null;
}

export async function getBatches(limit = 50): Promise<BatchRow[]> {
  const c = await db();
  return rows(await c.rpc("production_batches", { p_limit: limit }), "batches").map(
    (r: Record<string, unknown>) => ({
      id: str(r.batch_id),
      recipeId: str(r.recipe_id),
      recipeName: str(r.recipe_name),
      outputItemId: str(r.output_item_id),
      outputName: str(r.output_name),
      outputUnit: str(r.output_unit),
      batches: num(r.batches),
      plannedBase: num(r.planned_base),
      actualBase: num(r.actual_base),
      enteredUnit: str(r.entered_unit),
      status: str(r.status),
      producedAt: str(r.produced_at),
      madeBy: strOrNull(r.made_by),
      note: strOrNull(r.note),
      cancelledAt: strOrNull(r.cancelled_at),
      cancelledBy: strOrNull(r.cancelled_by),
      cancelReason: strOrNull(r.cancel_reason),
      value: numOrNull(r.value),
    }),
  );
}
