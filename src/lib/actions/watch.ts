"use server";
/**
 * The watch list (0094): a finding marked explained or looked into, with a
 * note; and whether the general manager reads the list too (the owner).
 */
import { z } from "zod";
import { badKey, callRpc, parse, refresh, type ActionResult } from "@/lib/db/rpc";
import { id, optionalText } from "@/lib/validation";

const settleInput = z.object({
  findingId: id("a finding"),
  status: z.enum(["explained", "looked_into"], { message: "Mark it explained or looked into" }),
  note: optionalText(300),
});

/** A finding settled (0094). Keyed; on the audit trail. */
export async function settleWatchFindingAction(
  input: z.input<typeof settleInput>,
  key: string,
): Promise<ActionResult<{ status: string }>> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(settleInput, input);
  if (!v.ok) return v;
  const r = await callRpc<Record<string, unknown>>("settle_watch_finding", {
    p_finding: v.data.findingId,
    p_status: v.data.status,
    p_note: v.data.note,
    p_idempotency_key: key,
  });
  if (!r.ok) return r;
  refresh("/reports/watch", "/dashboard");
  return { ok: true, data: { status: String(r.data.status ?? v.data.status) } };
}

const visibilityInput = z.object({ gmSees: z.boolean() });

/** Whether the general manager reads the watch list too (0094, the owner). On the audit trail. */
export async function setWatchVisibilityAction(
  input: z.input<typeof visibilityInput>,
): Promise<ActionResult<{ gmSees: boolean }>> {
  const v = parse(visibilityInput, input);
  if (!v.ok) return v;
  const r = await callRpc<boolean>("set_watch_visibility", { p_gm_sees: v.data.gmSees });
  if (!r.ok) return r;
  refresh("/settings", "/reports/watch", "/reports");
  return { ok: true, data: { gmSees: r.data === true } };
}
