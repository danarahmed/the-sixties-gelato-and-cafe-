import "server-only";
/** The kitchen's stations (0110). Null before 0110. */
import { db } from "./client";

export interface KitchenSetup {
  stations: { id: string; name: string; active: boolean }[];
  /** Each category's station. */
  categories: Record<string, string>;
}

export async function getKitchenSetup(): Promise<KitchenSetup | null> {
  const c = await db();
  const r = await c.rpc("kitchen_setup");
  if (r.error || !r.data) return null;
  const d = r.data as { stations?: Record<string, unknown>[]; categories?: Record<string, string> };
  return {
    stations: (d.stations ?? []).map((s) => ({
      id: String(s.id),
      name: String(s.name ?? ""),
      active: s.active !== false,
    })),
    categories: d.categories ?? {},
  };
}
