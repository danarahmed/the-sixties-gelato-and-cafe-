"use server";
/**
 * Use-by (0098): how an item keeps, chosen once; a lot's use-by changed with a
 * reason. Each is keyed, as every write is.
 */
import { z } from "zod";
import { badKey, callRpc, parse, refresh, type ActionResult } from "@/lib/db/rpc";
import { id } from "@/lib/validation";

const itemInput = z
  .object({
    itemId: id("an item"),
    mode: z.enum(["none", "keeps_days", "exact_date"], {
      message: "Choose how it keeps",
    }),
    days: z.number().int().min(1).max(365).nullable().default(null),
  })
  .refine((v) => v.mode !== "keeps_days" || v.days !== null, {
    message: "Say how many days it keeps from delivery: 1 to 365",
  });

export async function setItemUseByAction(
  input: z.input<typeof itemInput>,
  key: string,
): Promise<ActionResult<{ mode: string; days: number | null }>> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(itemInput, input);
  if (!v.ok) return v;
  const r = await callRpc<Record<string, unknown>>("set_item_use_by", {
    p_item: v.data.itemId,
    p_mode: v.data.mode,
    p_days: v.data.days,
    p_idempotency_key: key,
  });
  if (!r.ok) return r;
  refresh(`/inventory/${v.data.itemId}`, "/inventory", "/today", "/purchasing/buying-list");
  const days = r.data.keeps_days;
  return {
    ok: true,
    data: {
      mode: String(r.data.expiry_mode),
      days: days === null || days === undefined ? null : Number(days),
    },
  };
}

const lotInput = z.object({
  lotId: id("the lot"),
  useBy: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Give the new use-by"),
  reason: z.string().trim().min(1, "Say why the use-by changes").max(300),
});

export async function setLotUseByAction(
  input: z.input<typeof lotInput>,
  key: string,
): Promise<ActionResult<{ useBy: string }>> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(lotInput, input);
  if (!v.ok) return v;
  const r = await callRpc<Record<string, unknown>>("set_lot_use_by", {
    p_lot: v.data.lotId,
    p_use_by: v.data.useBy,
    p_reason: v.data.reason,
    p_idempotency_key: key,
  });
  if (!r.ok) return r;
  refresh("/inventory", "/today", "/production", "/dashboard");
  return { ok: true, data: { useBy: v.data.useBy } };
}
