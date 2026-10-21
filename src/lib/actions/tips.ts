"use server";
/**
 * Tips and the service charge (0090). The database checks the person may:
 * the service charge is set on Settings (settings.manage), who shares the tips
 * on Payroll (payroll.run).
 */
import { z } from "zod";
import { callRpc, parse, refresh, type ActionResult } from "@/lib/db/rpc";
import { id, salesChannel } from "@/lib/validation";

const serviceInput = z.object({
  channel: salesChannel,
  /** Null or 0 takes it off. */
  percent: z
    .number()
    .min(0, "A service charge is between 0 and 50%")
    .max(50, "A service charge is between 0 and 50%")
    .nullable(),
});

export async function setServiceChargeAction(
  input: z.input<typeof serviceInput>,
): Promise<ActionResult<Record<string, number>>> {
  const v = parse(serviceInput, input);
  if (!v.ok) return v;
  const r = await callRpc<Record<string, unknown>>("set_service_charge", {
    p_channel: v.data.channel,
    p_percent: v.data.percent,
  });
  if (!r.ok) return r;
  refresh("/settings", "/pos");
  const out: Record<string, number> = {};
  for (const [k, x] of Object.entries(r.data ?? {})) out[k] = Number(x);
  return { ok: true, data: out };
}

const sharersInput = z.object({
  employees: z.array(id("a person")).max(200),
});

export async function setTipSharersAction(
  input: z.input<typeof sharersInput>,
): Promise<ActionResult<null>> {
  const v = parse(sharersInput, input);
  if (!v.ok) return v;
  const r = await callRpc<unknown>("set_tip_sharers", { p_employees: v.data.employees });
  if (!r.ok) return r;
  refresh("/payroll");
  return { ok: true, data: null };
}
