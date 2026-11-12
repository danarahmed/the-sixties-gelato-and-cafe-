"use server";
/** Tax (0102): turned on or off, its kind and its rate, by the owner, with why. */
import { z } from "zod";
import { callRpc, parse, refresh, type ActionResult } from "@/lib/db/rpc";
import { text } from "@/lib/validation";

const taxInput = z.object({
  enabled: z.boolean(),
  kind: z.enum(["vat", "sales_tax"], { message: "Choose the kind of tax" }),
  rate: z
    .number({ message: "Tax turned on needs its rate" })
    .min(0, "Tax turned on needs its rate")
    .max(50),
  reason: text("Why", 300),
});

export async function setTaxSetupAction(
  input: z.input<typeof taxInput>,
): Promise<ActionResult<null>> {
  const v = parse(taxInput, input);
  if (!v.ok) return v;
  const r = await callRpc("set_tax_setup", {
    p_enabled: v.data.enabled,
    p_kind: v.data.kind,
    p_rate: v.data.rate,
    p_reason: v.data.reason,
  });
  if (!r.ok) return r;
  refresh("/settings");
  return { ok: true, data: null };
}
