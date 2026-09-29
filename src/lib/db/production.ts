import "server-only";
/**
 * What the café makes in batches, and the batches made (migration 0023); their
 * numbers, use-by dates and lots, what became of each, and the day's plan
 * (0046). All come from database functions that check the person's
 * permission; a batch's cost comes back only to those who may see costs.
 */
import { db, num, numOrNull, one, rows, str, strOrNull } from "./client";
import {
  lotsFrom,
  planFrom,
  productionReportFrom,
  reconciliationFrom,
  type BatchReconciliation,
  type ProductionLot,
  type ProductionPlan,
  type ReportBatch,
} from "@/lib/production";

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
  /** How long what it makes keeps, in hours; null when it has no use-by (0046). */
  shelfLifeHours: number | null;
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
      shelfLifeHours: numOrNull(r.shelf_life_hours),
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
  /** Its number, from the café's batch counter (0046). */
  batchNo: number;
  useBy: string | null;
  /** What is left in its lot; null for a batch made before lots. */
  leftBase: number | null;
  /** Why it was recorded after it was made. */
  lateReason: string | null;
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
      batchNo: num(r.batch_no),
      useBy: strOrNull(r.use_by),
      leftBase: numOrNull(r.left_base),
      lateReason: strOrNull(r.late_reason),
    }),
  );
}

/**
 * What to make on a day at a place (the first branch when none is named), from
 * what sold on that weekday in the weeks before.
 */
export async function getProductionPlan(
  day?: string,
  place: string | null = null,
): Promise<ProductionPlan> {
  const c = await db();
  return planFrom(
    one(
      await c.rpc("production_plan", { p_day: day ?? null, p_location: place }),
      "the day's plan",
    ),
  );
}

/** The lots with stock left at a place, the one used by first first. */
export async function getProductionLots(place: string | null = null): Promise<ProductionLot[]> {
  const c = await db();
  return lotsFrom(
    one(await c.rpc("production_lots", { p_location: place }), "the batches in stock"),
  );
}

/** One batch: what it made, and what became of it; null when there is no such batch. */
export async function getBatchReconciliation(batchId: string): Promise<BatchReconciliation | null> {
  const c = await db();
  const res = await c.rpc("batch_reconciliation", { p_batch: batchId });
  if (res.error?.message.includes("Batch not found")) return null;
  return reconciliationFrom(one(res, "the batch"));
}

/** Reports → Production: the batches made in the dates. */
export async function getProductionReport(
  from: string,
  to: string,
  place: string | null = null,
): Promise<ReportBatch[]> {
  const c = await db();
  return productionReportFrom(
    one(
      await c.rpc("report_production", { p_from: from, p_to: to, p_location: place }),
      "the production report",
    ),
  );
}
