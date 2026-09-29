"use server";
/**
 * Production: what the café makes in batches, and each batch made. A batch
 * takes its ingredients out of stock and puts what came out in, at what the
 * ingredients cost, in one database call (migration 0023); it is numbered,
 * used by a date, and made into a lot of its own (0046).
 */
import { z } from "zod";
import { badKey, callRpc, parse, refresh, type ActionResult } from "@/lib/db/rpc";
import { id, optionalText, positive, text } from "@/lib/validation";
import { placeForWrite } from "@/lib/place";

const PATHS = ["/production", "/inventory", "/products"];

const line = z.object({
  itemId: id("an ingredient"),
  qty: positive("Quantity"),
  unitCode: z.string().min(1),
});

const unit = z.string().trim().min(1, "Choose a unit").max(40);

/** A moment, as the form sends it: an ISO timestamp. */
const moment = z.string().datetime({ offset: true, message: "Enter a date and a time" });

const batchRecipeInput = z.object({
  recipeId: id("a batch recipe").nullable(),
  name: text("The name", 120),
  /** For a new recipe: an item already kept, or a new one and how it is measured. */
  output: z
    .union([
      z.object({ itemId: id("the item it makes") }),
      z.object({
        measure: z.enum(["weight", "volume", "pieces"], {
          message: "Say whether it is weighed, measured or counted in pieces",
        }),
        container: optionalText(40),
        containerQty: z.union([positive("What a container holds"), z.null()]).optional(),
        containerUnit: z.string().nullable().optional(),
      }),
    ])
    .nullable(),
  yieldQty: positive("What one batch makes"),
  yieldUnit: unit,
  /** Null keeps the ingredients as they are. */
  lines: z.array(line).min(1, "List what goes into a batch").nullable(),
  instructions: optionalText(2000),
  isActive: z.boolean().default(true),
  /**
   * How long what it makes keeps, in hours (0046): left out, as it was; null,
   * none; else an hour to a year.
   */
  keepsHours: z
    .union([
      z
        .number()
        .int("What it makes keeps for an hour to a year")
        .min(1, "What it makes keeps for an hour to a year")
        .max(8760, "What it makes keeps for an hour to a year"),
      z.null(),
    ])
    .optional(),
});

export async function saveBatchRecipeAction(
  input: z.input<typeof batchRecipeInput>,
  key: string,
): Promise<ActionResult<{ recipeId: string }>> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(batchRecipeInput, input);
  if (!v.ok) return v;
  const d = v.data;
  if (!d.recipeId && !d.output) return { ok: false, error: "Say what the batch makes" };
  if (!d.recipeId && !d.lines) return { ok: false, error: "List what goes into a batch" };
  const output =
    d.output === null
      ? null
      : "itemId" in d.output
        ? { item_id: d.output.itemId }
        : {
            measure: d.output.measure,
            container: d.output.container,
            container_qty: d.output.container ? (d.output.containerQty ?? null) : null,
            container_unit: d.output.container ? (d.output.containerUnit ?? null) : null,
          };
  if (output && "container" in output && output.container && !output.container_qty)
    return { ok: false, error: `Say how much one ${output.container} holds` };
  const r = await callRpc<Record<string, unknown>>("save_batch_recipe", {
    p_recipe: d.recipeId,
    p_name: d.name,
    p_output: output,
    p_yield: d.yieldQty,
    p_yield_unit: d.yieldUnit,
    p_lines:
      d.lines?.map((l) => ({ item_id: l.itemId, qty: l.qty, unit_code: l.unitCode })) ?? null,
    p_instructions: d.instructions,
    p_is_active: d.isActive,
    p_shelf_life_hours: d.keepsHours === undefined ? null : (d.keepsHours ?? 0),
    p_idempotency_key: key,
  });
  if (!r.ok) return r;
  refresh(...PATHS);
  return { ok: true, data: { recipeId: String(r.data.recipe_id) } };
}

const recordInput = z.object({
  recipeId: id("what was made"),
  batches: positive("The number of batches"),
  /** What came out, in any of the item's units; empty when it came out as the recipe says. */
  outputQty: z.union([positive("What came out"), z.null()]),
  outputUnit: z.string().nullable(),
  note: optionalText(300),
  /** A manager's approval of using more than the books hold (0040). */
  stockApprovalId: z.string().uuid().nullish(),
  /** When it was made, when that was earlier than now: a manager's, with why (0046). */
  producedAt: moment.nullish(),
  lateReason: optionalText(300),
  /** Its use-by, when not the recipe's shelf life from when it was made. */
  useBy: moment.nullish(),
});

export async function recordProductionAction(
  input: z.input<typeof recordInput>,
  key: string,
): Promise<
  ActionResult<{
    batchId: string;
    batchNo: number;
    actual: number;
    value: number | null;
    useBy: string | null;
  }>
> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(recordInput, input);
  if (!v.ok) return v;
  const r = await callRpc<Record<string, unknown>>("record_production", {
    p_recipe: v.data.recipeId,
    p_batches: v.data.batches,
    p_output_qty: v.data.outputQty,
    p_output_unit: v.data.outputQty === null ? null : v.data.outputUnit,
    p_note: v.data.note,
    p_location: await placeForWrite(),
    p_stock_approval: v.data.stockApprovalId ?? null,
    p_produced_at: v.data.producedAt ?? null,
    p_use_by: v.data.useBy ?? null,
    p_late_reason: v.data.producedAt ? v.data.lateReason : null,
    p_idempotency_key: key,
  });
  if (!r.ok) return r;
  refresh(...PATHS);
  return {
    ok: true,
    data: {
      batchId: String(r.data.batch_id),
      batchNo: Number(r.data.batch_no),
      actual: Number(r.data.actual),
      value: r.data.value === undefined ? null : Number(r.data.value),
      useBy: r.data.use_by ? String(r.data.use_by) : null,
    },
  };
}

const useByInput = z.object({
  batchId: id("a batch"),
  useBy: moment,
  reason: text("The reason", 300),
});

/** A batch's use-by changed by a manager, with why (0046). */
export async function setBatchUseByAction(
  input: z.input<typeof useByInput>,
  key: string,
): Promise<ActionResult<null>> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(useByInput, input);
  if (!v.ok) return v;
  const r = await callRpc("set_batch_use_by", {
    p_batch: v.data.batchId,
    p_use_by: v.data.useBy,
    p_reason: v.data.reason,
    p_idempotency_key: key,
  });
  if (!r.ok) return r;
  refresh(...PATHS, `/production/batches/${v.data.batchId}`, "/dashboard");
  return { ok: true, data: null };
}

const cancelInput = z.object({
  batchId: id("a batch"),
  reason: text("The reason", 300),
});

export async function cancelProductionAction(
  input: z.input<typeof cancelInput>,
  key: string,
): Promise<ActionResult<null>> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(cancelInput, input);
  if (!v.ok) return v;
  const r = await callRpc("cancel_production", {
    p_batch: v.data.batchId,
    p_reason: v.data.reason,
    p_idempotency_key: key,
  });
  if (!r.ok) return r;
  refresh(...PATHS);
  return { ok: true, data: null };
}
