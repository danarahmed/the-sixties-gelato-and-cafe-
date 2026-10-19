"use server";
/** Equipment (0081): added, depreciated month by month, sold or thrown out. */
import { z } from "zod";
import { badKey, callRpc, parse, refresh, type ActionResult } from "@/lib/db/rpc";
import { id } from "@/lib/validation";

const PATHS = ["/accounting", "/reports", "/journals", "/dashboard"];

const addInput = z.object({
  name: z.string().trim().min(1, "Name the equipment").max(80, "A name is at most 80 letters"),
  cost: z.number().positive("Enter what it cost"),
  salvage: z.number().nonnegative("What it is worth at the end is less than what it cost"),
  lifeMonths: z
    .number()
    .int("It is used for 1 to 600 months")
    .min(1, "It is used for 1 to 600 months")
    .max(600, "It is used for 1 to 600 months"),
  startOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "It was bought on a day up to today"),
  paidFrom: z.string().nullable(),
});

export async function addEquipmentAction(
  input: z.input<typeof addInput>,
  key: string,
): Promise<ActionResult<null>> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(addInput, input);
  if (!v.ok) return v;
  const r = await callRpc("add_fixed_asset", {
    p_name: v.data.name,
    p_cost: v.data.cost,
    p_life_months: v.data.lifeMonths,
    p_start_on: v.data.startOn,
    p_salvage: v.data.salvage,
    p_paid_from: v.data.paidFrom,
    p_idempotency_key: key,
  });
  if (!r.ok) return r;
  refresh(...PATHS);
  return { ok: true, data: null };
}

export async function depreciateAction(
  key: string,
): Promise<ActionResult<{ months: number; amount: number }>> {
  const bad = badKey(key);
  if (bad) return bad;
  const r = await callRpc<Record<string, unknown>>("depreciate_to", { p_idempotency_key: key });
  if (!r.ok) return r;
  refresh(...PATHS);
  return {
    ok: true,
    data: { months: Number(r.data.months ?? 0), amount: Number(r.data.amount ?? 0) },
  };
}

const disposeInput = z.object({
  assetId: id("the equipment"),
  on: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "It went on a day from when it was bought up to today"),
  fetched: z.number().nonnegative("Enter what it fetched, 0 or more"),
  into: z.enum(["bank", "safe"]).nullable(),
});

export async function disposeEquipmentAction(
  input: z.input<typeof disposeInput>,
  key: string,
): Promise<ActionResult<null>> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(disposeInput, input);
  if (!v.ok) return v;
  const r = await callRpc("dispose_fixed_asset", {
    p_asset: v.data.assetId,
    p_on: v.data.on,
    p_fetched: v.data.fetched,
    p_into: v.data.into,
    p_idempotency_key: key,
  });
  if (!r.ok) return r;
  refresh(...PATHS);
  return { ok: true, data: null };
}
