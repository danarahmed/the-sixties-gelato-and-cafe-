import "server-only";
/** The menu on the customer's phone (0118): read with the owner's link, signed in or not. */
import { db } from "./client";
import { publicMenuFrom, type PublicMenu } from "@/lib/qrOrder";

export async function getPublicMenu(token: string): Promise<PublicMenu | null> {
  if (!/^[A-Za-z0-9_-]{20,40}$/.test(token)) return null;
  const c = await db();
  const r = await c.rpc("public_menu", { p_token: token });
  if (r.error) return null;
  return publicMenuFrom(r.data);
}

export interface PublicMenuSetup {
  enabled: boolean;
  token: string;
  locationId: string | null;
}

/** The link as it stands (settings.manage); null before it was ever turned on, or before 0118. */
export async function getPublicMenuSetup(): Promise<PublicMenuSetup | null | undefined> {
  const c = await db();
  const r = await c.rpc("public_menu_setup");
  if (r.error) return undefined;
  if (!r.data) return null;
  const o = r.data as Record<string, unknown>;
  return {
    enabled: o.enabled === true,
    token: String(o.token ?? ""),
    locationId: o.location_id ? String(o.location_id) : null,
  };
}
