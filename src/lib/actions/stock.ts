"use server";
/**
 * Stock: new items, waste, corrections and blind counts. The database values
 * every movement at its own average cost and journals it in the same step —
 * no cost or movement type is ever taken from the browser (audit M-13, H-12).
 */
import { z } from "zod";
import { callRpc, parse, refresh, type ActionResult } from "@/lib/db/rpc";
import { WASTE_TYPES } from "@/lib/format";
import {
  id,
  optionalNonNegative,
  optionalText,
  positive,
  signedNonZero,
  text,
} from "@/lib/validation";

const STOCK_PATHS = ["/inventory", "/dashboard", "/reports", "/journals", "/count"];

const itemInput = z.object({
  name: text("Name", 120),
  nameAr: optionalText(120),
  nameCkb: optionalText(120),
  itemType: z.enum(["ingredient", "packaging", "consumable", "finished_good", "resale"], {
    message: "Choose a type",
  }),
  baseUnit: text("Base unit", 20),
  dimension: z.enum(["count", "mass", "volume"], { message: "Choose how it is measured" }),
  minLevel: optionalNonNegative("Reorder level"),
  openingQty: optionalNonNegative("Opening quantity"),
  openingUnitCost: optionalNonNegative("Opening cost"),
  returnable: z.boolean().default(false),
});

/** A new stock item; opening stock is journaled (Dr Inventory / Cr Owner equity). */
export async function createItemAction(
  input: z.input<typeof itemInput>,
): Promise<ActionResult<{ itemId: string }>> {
  const v = parse(itemInput, input);
  if (!v.ok) return v;
  const d = v.data;
  if (d.openingQty && Number(d.openingQty) > 0 && d.openingUnitCost === null) {
    return { ok: false, error: "Opening stock needs its cost per unit" };
  }
  const r = await callRpc<Record<string, unknown>>("create_item", {
    p_name: d.name,
    p_item_type: d.itemType,
    p_base_unit: d.baseUnit,
    p_dimension: d.dimension,
    p_name_ar: d.nameAr,
    p_name_ckb: d.nameCkb,
    p_min_level: d.minLevel,
    p_units: [],
    p_opening_qty: d.openingQty,
    p_opening_unit_cost: d.openingUnitCost,
    p_returnable: d.returnable,
  });
  if (!r.ok) return r;
  refresh(...STOCK_PATHS, "/products", "/purchasing");
  return { ok: true, data: { itemId: String(r.data.item_id) } };
}

const wasteInput = z.object({
  itemId: id("an item"),
  qty: positive("Quantity"),
  unitCode: z.string().min(1).nullable(),
  type: z.enum(WASTE_TYPES, { message: "Choose what happened" }),
  reason: text("What happened", 300),
});

export async function recordWasteAction(
  input: z.input<typeof wasteInput>,
): Promise<ActionResult<{ value?: number; journalNo: number | null }>> {
  const v = parse(wasteInput, input);
  if (!v.ok) return v;
  const r = await callRpc<Record<string, unknown>>("record_waste", {
    p_item: v.data.itemId,
    p_qty: v.data.qty,
    p_unit_code: v.data.unitCode,
    p_type: v.data.type,
    p_reason: v.data.reason,
  });
  if (!r.ok) return r;
  refresh(...STOCK_PATHS);
  return {
    ok: true,
    data: {
      ...(r.data.value !== undefined ? { value: Number(r.data.value) } : {}),
      journalNo: r.data.journal_no == null ? null : Number(r.data.journal_no),
    },
  };
}

const adjustInput = z.object({
  itemId: id("an item"),
  delta: signedNonZero("The correction"),
  unitCode: z.string().min(1).nullable(),
  reason: text("A reason", 300),
  unitCost: optionalNonNegative("Unit cost"),
});

/** A manager's correction outside a count, posted against 5400 Inventory count variance. */
export async function adjustStockAction(
  input: z.input<typeof adjustInput>,
): Promise<ActionResult<{ value: number; journalNo: number | null }>> {
  const v = parse(adjustInput, input);
  if (!v.ok) return v;
  const r = await callRpc<Record<string, unknown>>("adjust_stock", {
    p_item: v.data.itemId,
    p_delta: v.data.delta,
    p_unit_code: v.data.unitCode,
    p_reason: v.data.reason,
    p_unit_cost: v.data.unitCost,
  });
  if (!r.ok) return r;
  refresh(...STOCK_PATHS);
  return {
    ok: true,
    data: {
      value: Number(r.data.value ?? 0),
      journalNo: r.data.journal_no == null ? null : Number(r.data.journal_no),
    },
  };
}

/* --------------------------------------------------------------- counting */

/** Opens a blind count; the database snapshots what it expects, out of sight. */
export async function startCountAction(): Promise<ActionResult<{ countId: string }>> {
  const r = await callRpc<string>("start_stock_count", { p_items: null });
  if (!r.ok) return r;
  refresh("/count");
  return { ok: true, data: { countId: String(r.data) } };
}

const countLine = z.object({
  countId: id("a count"),
  itemId: id("an item"),
  counted: optionalNonNegative("Count"),
});

export async function recordCountAction(
  input: z.input<typeof countLine>,
): Promise<ActionResult<null>> {
  const v = parse(countLine, input);
  if (!v.ok) return v;
  if (v.data.counted === null) return { ok: false, error: "Enter what you counted" };
  const r = await callRpc("record_count", {
    p_count: v.data.countId,
    p_item: v.data.itemId,
    p_counted: v.data.counted,
    p_unit_code: null,
  });
  if (!r.ok) return r;
  return { ok: true, data: null };
}

const countId = z.object({ countId: id("a count") });

export async function submitCountAction(
  input: z.input<typeof countId>,
): Promise<ActionResult<null>> {
  const v = parse(countId, input);
  if (!v.ok) return v;
  const r = await callRpc("submit_stock_count", { p_count: v.data.countId });
  if (!r.ok) return r;
  refresh("/count", "/accounting");
  return { ok: true, data: null };
}

/** A second person approves; variances post as of the moment the count was submitted. */
export async function approveCountAction(
  input: z.input<typeof countId>,
): Promise<ActionResult<{ loss: number; gain: number; journalNo: number | null }>> {
  const v = parse(countId, input);
  if (!v.ok) return v;
  const r = await callRpc<Record<string, unknown>>("approve_stock_count", {
    p_count: v.data.countId,
  });
  if (!r.ok) return r;
  refresh(...STOCK_PATHS, "/accounting");
  return {
    ok: true,
    data: {
      loss: Number(r.data.loss ?? 0),
      gain: Number(r.data.gain ?? 0),
      journalNo: r.data.journal_no == null ? null : Number(r.data.journal_no),
    },
  };
}

const rejectInput = z.object({ countId: id("a count"), reason: text("A reason", 300) });

export async function rejectCountAction(
  input: z.input<typeof rejectInput>,
): Promise<ActionResult<null>> {
  const v = parse(rejectInput, input);
  if (!v.ok) return v;
  const r = await callRpc("reject_stock_count", {
    p_count: v.data.countId,
    p_reason: v.data.reason,
  });
  if (!r.ok) return r;
  refresh("/count", "/accounting");
  return { ok: true, data: null };
}
