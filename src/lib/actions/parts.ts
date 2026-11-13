"use server";
/** Plans, parts and the type of business (0108). */
import { z } from "zod";
import { callRpc, parse, refresh, type ActionResult } from "@/lib/db/rpc";
import { id, text } from "@/lib/validation";

const PATHS = ["/settings", "/admin/businesses", "/today"];

export async function setBusinessPartAction(input: {
  part: string;
  on: boolean;
  reason: string;
}): Promise<ActionResult<null>> {
  const v = parse(
    z.object({
      part: z.string().regex(/^[a-z_]{2,30}$/, "Choose one of the system's parts"),
      on: z.boolean(),
      reason: text("Why", 300),
    }),
    input,
  );
  if (!v.ok) return v;
  const r = await callRpc("set_business_part", {
    p_part: v.data.part,
    p_on: v.data.on,
    p_reason: v.data.reason,
  });
  if (!r.ok) return r;
  refresh(...PATHS);
  return { ok: true, data: null };
}

export async function setBusinessTypeAction(input: {
  type: string;
  reason: string;
}): Promise<ActionResult<null>> {
  const v = parse(
    z.object({
      type: z.enum(["cafe", "bakery", "restaurant", "supplier"], {
        message: "Choose the type of business: a café, a bakery, a restaurant or a supplier",
      }),
      reason: text("Why", 300),
    }),
    input,
  );
  if (!v.ok) return v;
  const r = await callRpc("set_business_type", { p_type: v.data.type, p_reason: v.data.reason });
  if (!r.ok) return r;
  refresh(...PATHS);
  return { ok: true, data: null };
}

export async function setBusinessPlanAction(input: {
  businessId: string;
  plan: string;
  reason: string;
}): Promise<ActionResult<null>> {
  const v = parse(
    z.object({
      businessId: id("a business"),
      plan: z.enum(["starter", "complete", "business"], {
        message: "Choose the plan: Starter, Complete or Business",
      }),
      reason: text("Why", 300),
    }),
    input,
  );
  if (!v.ok) return v;
  const r = await callRpc("set_business_plan", {
    p_business: v.data.businessId,
    p_plan: v.data.plan,
    p_reason: v.data.reason,
  });
  if (!r.ok) return r;
  refresh(...PATHS);
  return { ok: true, data: null };
}
