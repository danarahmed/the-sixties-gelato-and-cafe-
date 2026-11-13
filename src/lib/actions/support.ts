"use server";
/** Support access (0109): given by the owner for some hours; used by the system's administrators. */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { callRpc, parse, refresh, type ActionResult } from "@/lib/db/rpc";
import { id, text } from "@/lib/validation";
import { SUPPORT_COOKIE } from "@/lib/practice";

export async function grantSupportAction(input: {
  hours: number;
  reason: string;
}): Promise<ActionResult<null>> {
  const v = parse(
    z.object({
      hours: z
        .number()
        .int("Support access is for 1 to 72 hours")
        .min(1, "Support access is for 1 to 72 hours")
        .max(72, "Support access is for 1 to 72 hours"),
      reason: text("Why", 300),
    }),
    input,
  );
  if (!v.ok) return v;
  const r = await callRpc("grant_support_access", {
    p_hours: v.data.hours,
    p_reason: v.data.reason,
  });
  if (!r.ok) return r;
  refresh("/settings");
  return { ok: true, data: null };
}

export async function revokeSupportAction(): Promise<ActionResult<null>> {
  const r = await callRpc("revoke_support_access", {});
  if (!r.ok) return r;
  refresh("/settings");
  return { ok: true, data: null };
}

/** An administrator looks at a business that gave access: recorded, then its screens, read-only. */
export async function enterSupportAction(businessId: string): Promise<ActionResult<null>> {
  const v = parse(z.object({ businessId: id("a business") }), { businessId });
  if (!v.ok) return v;
  const r = await callRpc("support_enter", { p_business: v.data.businessId });
  if (!r.ok) return r;
  const store = await cookies();
  store.set(SUPPORT_COOKIE, v.data.businessId, { path: "/", sameSite: "lax", httpOnly: true });
  redirect("/today");
}

/** Back to their own business. */
export async function leaveSupportAction(): Promise<void> {
  const store = await cookies();
  store.delete(SUPPORT_COOKIE);
  redirect("/admin/businesses");
}
