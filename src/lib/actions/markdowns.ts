"use server";
/** End-of-day markdowns (0079): sizes marked down till the day ends, or stopped. */
import { z } from "zod";
import { badKey, callRpc, parse, refresh, type ActionResult } from "@/lib/db/rpc";
import { id } from "@/lib/validation";
import { tillForWrite } from "@/lib/place";

const PATHS = ["/production", "/end-of-day", "/pos", "/dashboard"];

const markInput = z.object({
  variantIds: z.array(id("a product")).min(1, "Choose what to mark down"),
  percent: z
    .number()
    .int("A markdown is from 5% to 90% off, in whole percent")
    .min(5, "A markdown is from 5% to 90% off, in whole percent")
    .max(90, "A markdown is from 5% to 90% off, in whole percent"),
});

export async function markDownAction(
  input: z.input<typeof markInput>,
  key: string,
): Promise<ActionResult<{ marked: number }>> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(markInput, input);
  if (!v.ok) return v;
  const r = await callRpc<Record<string, unknown>>("mark_down", {
    p_variants: v.data.variantIds,
    p_percent: v.data.percent,
    p_location: await tillForWrite(),
    p_idempotency_key: key,
  });
  if (!r.ok) return r;
  refresh(...PATHS);
  return { ok: true, data: { marked: Number(r.data.marked ?? 0) } };
}

export async function stopMarkdownAction(
  markdownId: string,
  key: string,
): Promise<ActionResult<null>> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(z.object({ markdownId: id("a markdown") }), { markdownId });
  if (!v.ok) return v;
  const r = await callRpc<unknown>("stop_markdown", {
    p_markdown: v.data.markdownId,
    p_idempotency_key: key,
  });
  if (!r.ok) return r;
  refresh(...PATHS);
  return { ok: true, data: null };
}
