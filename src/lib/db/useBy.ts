import "server-only";
/**
 * Use-by (0098): what is near or past its use-by at a place, the till's
 * marks, and how an item keeps. Empty, or null, before 0098 is applied, so no
 * screen fails while the database waits for it.
 */
import { db } from "./client";
import { tillMarksFrom, readUseByList, type ExpiryMode, type UseByList } from "@/lib/useBy";

export async function getUseByLots(
  opts: { locationId?: string | null; all?: boolean } = {},
): Promise<UseByList | null> {
  const c = await db();
  const r = await c.rpc("use_by_lots", {
    p_location: opts.locationId ?? null,
    p_all: opts.all ?? false,
  });
  if (r.error) return null;
  return readUseByList(r.data);
}

/** The till's marks, as plain rows (the till keeps them with its menu). */
export async function getTillMarks(
  locationId: string | null = null,
): Promise<{ variantId: string; state: "expired" | "soon"; item: string }[]> {
  const c = await db();
  const r = await c.rpc("pos_use_by", { p_location: locationId });
  if (r.error) return [];
  return [...tillMarksFrom(r.data)].map(([variantId, m]) => ({ variantId, ...m }));
}

/** How an item keeps; null before 0098. */
export async function getItemKeeping(
  itemId: string,
): Promise<{ mode: ExpiryMode | null; keepsDays: number | null } | null> {
  const c = await db();
  const r = await c.from("item").select("expiry_mode,keeps_days").eq("id", itemId).limit(1);
  if (r.error) return null;
  const row = (r.data ?? [])[0] as Record<string, unknown> | undefined;
  if (!row) return null;
  const mode = row.expiry_mode;
  return {
    mode: mode === "none" || mode === "keeps_days" || mode === "exact_date" ? mode : null,
    keepsDays:
      row.keeps_days === null || row.keeps_days === undefined ? null : Number(row.keeps_days),
  };
}

/** How each of the given items keeps (the delivery form); empty before 0098. */
export async function getItemsKeeping(): Promise<
  Record<string, { mode: ExpiryMode | null; keepsDays: number | null }>
> {
  const c = await db();
  const r = await c.from("item").select("id,expiry_mode,keeps_days").eq("is_active", true);
  if (r.error) return {};
  const out: Record<string, { mode: ExpiryMode | null; keepsDays: number | null }> = {};
  for (const row of (r.data ?? []) as Record<string, unknown>[]) {
    const mode = row.expiry_mode;
    out[String(row.id)] = {
      mode: mode === "none" || mode === "keeps_days" || mode === "exact_date" ? mode : null,
      keepsDays:
        row.keeps_days === null || row.keeps_days === undefined ? null : Number(row.keeps_days),
    };
  }
  return out;
}
