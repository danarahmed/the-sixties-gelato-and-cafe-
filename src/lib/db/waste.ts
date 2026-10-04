import "server-only";
import { db, str } from "@/lib/db/client";
import { readInBatches } from "@/lib/db/batches";
import { getProductionReport } from "@/lib/db/production";
import type { WasteBatch } from "@/lib/waste";

/**
 * Waste by recipe (round six): the batches made from `from` to `to`, at a
 * place or everywhere, each with what became of it (the production report,
 * 0046, cost.view) and what its lot lost by kind — thrown away, or eaten and
 * given — read from the lot's movements (0046, cost.view). Nothing on it is new.
 */
export async function getWasteBatches(
  from: string,
  to: string,
  location: string | null,
): Promise<WasteBatch[]> {
  const report = (await getProductionReport(from, to, location)).filter(
    (b) => b.status !== "cancelled" && b.story,
  );
  if (report.length === 0) return [];
  const c = await db();
  const lots = await readInBatches(
    report.map((b) => b.batchId),
    (batch) =>
      c
        .from("item_lot")
        .select("id,production_batch_id")
        .in("production_batch_id", batch)
        .order("production_batch_id")
        .order("id"),
    "the batches' lots",
  );
  const batchOf = new Map(lots.map((l) => [str(l.id), str(l.production_batch_id)]));
  // What each lot gave up to a loss, by the loss's kind.
  const moves = await readInBatches(
    [...batchOf.keys()],
    (batch) =>
      c
        .from("lot_movement")
        .select("id,lot_id,base_qty,inventory_movement(type)")
        .in("lot_id", batch)
        .lt("base_qty", 0)
        .order("lot_id")
        .order("id"),
    "what became of the batches",
  );
  const losses = new Map<string, Record<string, number>>();
  for (const m of moves) {
    const move = m.inventory_movement as { type?: unknown } | null;
    const kind = str(move?.type);
    const batch = batchOf.get(str(m.lot_id));
    if (!batch || !kind) continue;
    const of = losses.get(batch) ?? {};
    of[kind] = (of[kind] ?? 0) - Number(m.base_qty);
    losses.set(batch, of);
  }
  return report.map((b) => ({
    batchId: b.batchId,
    recipe: b.recipe,
    item: b.item,
    baseUnit: b.baseUnit,
    status: b.status,
    actual: b.actual,
    value: b.value,
    story: b.story,
    losses: losses.get(b.batchId) ?? {},
  }));
}
