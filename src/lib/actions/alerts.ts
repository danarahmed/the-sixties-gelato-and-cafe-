"use server";
/**
 * Answering the alerts (0029, the audit's P1-8): seen, with a note of what was
 * done or why it is fine; or put off until a day, with a reason. Either way
 * the alert stays open until its condition clears, and the answer is on the
 * audit trail. And the thresholds the rules use, set by the owner.
 */
import { z } from "zod";
import { callRpc, parse, refresh, type ActionResult } from "@/lib/db/rpc";
import { day, id } from "@/lib/validation";

const ackInput = z.object({
  alertId: id("the alert"),
  note: z
    .string()
    .trim()
    .min(3, "Say what was done about it, or why it is fine")
    .max(300, "Keep the note under 300 characters"),
});

/** Seen, with a note: what was done about it, or why it is fine. */
export async function acknowledgeAlertAction(
  input: z.input<typeof ackInput>,
): Promise<ActionResult<null>> {
  const v = parse(ackInput, input);
  if (!v.ok) return v;
  const r = await callRpc("acknowledge_alert", { p_alert: v.data.alertId, p_note: v.data.note });
  if (!r.ok) return r;
  refresh("/dashboard");
  return { ok: true, data: null };
}

const snoozeInput = z.object({
  alertId: id("the alert"),
  until: day("Until"),
  reason: z
    .string()
    .trim()
    .min(3, "Say why it can wait")
    .max(300, "Keep the reason under 300 characters"),
});

/** Out of sight until a day in the next 30, with a reason; it comes back then if still true. */
export async function snoozeAlertAction(
  input: z.input<typeof snoozeInput>,
): Promise<ActionResult<null>> {
  const v = parse(snoozeInput, input);
  if (!v.ok) return v;
  const r = await callRpc("snooze_alert", {
    p_alert: v.data.alertId,
    p_until: v.data.until,
    p_reason: v.data.reason,
  });
  if (!r.ok) return r;
  refresh("/dashboard");
  return { ok: true, data: null };
}

const thresholdsInput = z.record(z.string().regex(/^[a-z_]+$/), z.number().finite().nullable());

/** The owner's thresholds: a number, or null to follow the default again. */
export async function setAlertThresholdsAction(
  changes: z.input<typeof thresholdsInput>,
): Promise<ActionResult<null>> {
  const v = parse(thresholdsInput, changes);
  if (!v.ok) return v;
  const r = await callRpc("set_alert_thresholds", { p_settings: v.data });
  if (!r.ok) return r;
  refresh("/settings", "/dashboard");
  return { ok: true, data: null };
}
