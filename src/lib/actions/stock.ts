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
  /** Where the opening stock came from: it is the owner's capital (0027). */
  openingReason: optionalText(300),
  returnable: z.boolean().default(false),
});

/**
 * A new stock item, its name unlike any other item in use. Opening stock is
 * the owner's, with where it came from, and is journaled (Dr Inventory / Cr
 * Owner equity).
 */
export async function createItemAction(
  input: z.input<typeof itemInput>,
): Promise<ActionResult<{ itemId: string }>> {
  const v = parse(itemInput, input);
  if (!v.ok) return v;
  const d = v.data;
  if (d.openingQty && Number(d.openingQty) > 0 && d.openingUnitCost === null) {
    return { ok: false, error: "Opening stock needs its cost per unit" };
  }
  if (d.openingQty && Number(d.openingQty) > 0 && d.openingReason === null) {
    return { ok: false, error: "Say where this stock came from (the opening count, say)" };
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
    p_opening_reason: d.openingReason,
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

const openingInput = z.object({
  itemId: id("an item"),
  qty: positive("Quantity on the shelf"),
  unitCode: z.string().min(1).nullable(),
  unitCost: positive("Cost per unit"),
  reason: text("Where this stock came from", 300),
});

/**
 * Opening stock for an item with no stock history yet (0024), at what it cost:
 * Dr Inventory / Cr Owner equity, as a new item's opening stock is posted. It
 * is capital the owner puts in, so it is the owner's, with a reason (0027).
 */
export async function recordOpeningStockAction(
  input: z.input<typeof openingInput>,
): Promise<ActionResult<{ qty: number; value: number; journalNo: number | null }>> {
  const v = parse(openingInput, input);
  if (!v.ok) return v;
  const r = await callRpc<Record<string, unknown>>("record_opening_stock", {
    p_item: v.data.itemId,
    p_qty: v.data.qty,
    p_unit_code: v.data.unitCode,
    p_unit_cost: v.data.unitCost,
    p_reason: v.data.reason,
  });
  if (!r.ok) return r;
  refresh(...STOCK_PATHS, "/products");
  return {
    ok: true,
    data: {
      qty: Number(r.data.qty ?? 0),
      value: Number(r.data.value ?? 0),
      journalNo: r.data.journal_no == null ? null : Number(r.data.journal_no),
    },
  };
}

const updateItemInput = z.object({
  itemId: id("an item"),
  name: text("Name", 120),
  nameAr: optionalText(120),
  nameCkb: optionalText(120),
  itemType: z.enum(["ingredient", "packaging", "consumable", "finished_good", "resale"], {
    message: "Choose a type",
  }),
  minLevel: optionalNonNegative("Reorder level"),
  parLevel: optionalNonNegative("Par level"),
  isActive: z.boolean(),
  reason: optionalText(300),
});

/**
 * An item corrected (0027, the audit's P1-4): its names, type and levels, and
 * whether it is in use. Its base unit never changes — its whole history is
 * counted in it. The database keeps the name unique among items in use,
 * refuses to take an item out of use while it has stock or anything needs it,
 * and puts the change on the audit trail with its values before and after.
 */
export async function updateItemAction(
  input: z.input<typeof updateItemInput>,
): Promise<ActionResult<null>> {
  const v = parse(updateItemInput, input);
  if (!v.ok) return v;
  const d = v.data;
  const r = await callRpc("update_item", {
    p_item: d.itemId,
    p_name: d.name,
    p_item_type: d.itemType,
    p_name_ar: d.nameAr,
    p_name_ckb: d.nameCkb,
    p_min_level: d.minLevel,
    p_par_level: d.parLevel,
    p_is_active: d.isActive,
    p_reason: d.reason,
  });
  if (!r.ok) return r;
  refresh(...STOCK_PATHS, `/inventory/${d.itemId}`, "/products", "/purchasing", "/production");
  return { ok: true, data: null };
}

const unitInput = z.object({
  itemId: id("an item"),
  code: z
    .string()
    .transform((c) => c.trim())
    .refine((c) => /^[A-Za-z][A-Za-z0-9_]{0,23}$/.test(c), {
      message: "Name the unit in letters, digits and _ (such as case_24)",
    }),
  label: optionalText(60),
  factor: positive("How many it holds"),
});

/**
 * A pack size for an item: a case of 24, a sleeve of 50 (0027). A unit in use
 * keeps its size for good, so a different size is a new unit of its own.
 */
export async function addItemUnitAction(
  input: z.input<typeof unitInput>,
): Promise<ActionResult<null>> {
  const v = parse(unitInput, input);
  if (!v.ok) return v;
  const r = await callRpc("add_item_unit", {
    p_item: v.data.itemId,
    p_code: v.data.code,
    p_label: v.data.label,
    p_factor: v.data.factor,
  });
  if (!r.ok) return r;
  refresh("/inventory", `/inventory/${v.data.itemId}`, "/purchasing", "/count", "/products");
  return { ok: true, data: null };
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

const cancelCountInput = z.object({
  countId: id("a count"),
  reason: text("Why the count is cancelled", 300),
});

/** A count still being counted is cancelled by its counter or a manager, with a reason. */
export async function cancelCountAction(
  input: z.input<typeof cancelCountInput>,
): Promise<ActionResult<null>> {
  const v = parse(cancelCountInput, input);
  if (!v.ok) return v;
  const r = await callRpc("cancel_stock_count", {
    p_count: v.data.countId,
    p_reason: v.data.reason,
  });
  if (!r.ok) return r;
  refresh("/count");
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
