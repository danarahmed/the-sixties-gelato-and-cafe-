"use server";
/** The menu on the customer's phone (0118): the owner's link, on or off, at a place, or a new one. */
import { z } from "zod";
import { callRpc, parse, refresh, type ActionResult } from "@/lib/db/rpc";

const input = z.object({
  enabled: z.boolean(),
  locationId: z.string().guid().nullable().default(null),
  newLink: z.boolean().default(false),
});

export async function setPublicMenuAction(
  v0: z.input<typeof input>,
): Promise<ActionResult<{ enabled: boolean; token: string }>> {
  const v = parse(input, v0);
  if (!v.ok) return v;
  const r = await callRpc<Record<string, unknown>>("set_public_menu", {
    p_enabled: v.data.enabled,
    p_location: v.data.locationId,
    p_new_link: v.data.newLink,
  });
  if (!r.ok) return r;
  refresh("/settings");
  return {
    ok: true,
    data: { enabled: r.data.enabled === true, token: String(r.data.token ?? "") },
  };
}
