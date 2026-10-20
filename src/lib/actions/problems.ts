"use server";
/** "Something's wrong" (G5, 0083): said from any screen; dealt with by the owner or a manager. */
import { z } from "zod";
import { badKey, callRpc, parse, refresh, type ActionResult } from "@/lib/db/rpc";
import { id } from "@/lib/validation";
import { tillForWrite } from "@/lib/place";

const reportInput = z.object({
  page: z.string().trim().min(1).max(200),
  what: z
    .string()
    .trim()
    .min(2, "Say in a word or two what went wrong")
    .max(500, "At most 500 letters"),
  context: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])),
});

export async function reportProblemAction(
  input: z.input<typeof reportInput>,
  key: string,
): Promise<ActionResult<null>> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(reportInput, input);
  if (!v.ok) return v;
  const r = await callRpc("report_problem", {
    p_page: v.data.page,
    p_what: v.data.what,
    p_context: v.data.context,
    p_location: await tillForWrite(),
    p_idempotency_key: key,
  });
  if (!r.ok) return r;
  refresh("/problems", "/dashboard");
  return { ok: true, data: null };
}

const settleInput = z.object({
  reportId: id("the report"),
  done: z.boolean(),
  note: z.string().trim().max(300, "A note is at most 300 letters").nullable(),
});

export async function settleProblemAction(
  input: z.input<typeof settleInput>,
): Promise<ActionResult<null>> {
  const v = parse(settleInput, input);
  if (!v.ok) return v;
  const r = await callRpc("settle_problem", {
    p_report: v.data.reportId,
    p_done: v.data.done,
    p_note: v.data.note || null,
  });
  if (!r.ok) return r;
  refresh("/problems", "/dashboard");
  return { ok: true, data: null };
}
