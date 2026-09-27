"use server";
/**
 * Setting a rule on Settings → Rules (0040, release O): a value, or back to
 * the default, always with a reason. The database checks the person manages
 * the settings, the rule may be set for what it is set for, and the value is
 * within its limits; every change is kept, and on the audit trail.
 */
import { z } from "zod";
import { badKey, callRpc, parse, refresh, type ActionResult } from "@/lib/db/rpc";
import { RULE_ORDER } from "@/lib/rules";

const ruleInput = z.object({
  key: z.enum(RULE_ORDER, { message: "Unknown rule" }),
  scopeType: z.enum(["business", "role", "location", "item_type", "item"], {
    message: "This rule is not set that way",
  }),
  scopeId: z.string().max(80).nullable(),
  /** Null: back to the default. */
  value: z.union([z.number(), z.string().max(40), z.null()]),
  reason: z
    .string()
    .trim()
    .min(1, "Say why the rule is changing")
    .max(300, "Keep the reason under 300 characters"),
});

export async function setBusinessRuleAction(
  input: z.input<typeof ruleInput>,
  key: string,
): Promise<ActionResult<{ value: number | string | null; isDefault: boolean }>> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(ruleInput, input);
  if (!v.ok) return v;
  const r = await callRpc<Record<string, unknown>>("set_business_rule", {
    p_key: v.data.key,
    p_scope_type: v.data.scopeType,
    p_scope_id: v.data.scopeType === "business" ? null : v.data.scopeId,
    p_value: v.data.value,
    p_reason: v.data.reason,
    p_idempotency_key: key,
  });
  if (!r.ok) return r;
  // The till, refunds, losses and the dashboard all read the rules.
  refresh(
    "/settings",
    "/settings/rules",
    "/pos",
    "/orders",
    "/inventory",
    "/production",
    "/dashboard",
  );
  return {
    ok: true,
    data: {
      value:
        r.data.value == null
          ? null
          : typeof r.data.value === "number"
            ? r.data.value
            : String(r.data.value),
      isDefault: Boolean(r.data.default),
    },
  };
}
