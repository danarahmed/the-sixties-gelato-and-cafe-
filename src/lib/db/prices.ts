import "server-only";
import { db, rows, str } from "@/lib/db/client";
import { readInBatches } from "@/lib/db/batches";
import { getItemPriceHistory, getItems, type ItemRow } from "@/lib/db/read";
import { getItemCosts, getMenuCosting, getMenuRecipeLines } from "@/lib/db/reports";
import { getBatchRecipes } from "@/lib/db/production";
import { getSalesAnalysis } from "@/lib/db/analysis";
import { addDays } from "@/lib/dates";
import { riseOf, servingUses, touch, type Rise, type Touch } from "@/lib/prices";

/** A size on a channel a rise touches, by name, and what the rise comes to on it over a month. */
export interface PriceTouch extends Touch {
  product: string;
  size: string;
  /** Sold in the 30 days to today. */
  sold: number;
}

/** An item that came in dearer: by how much, and what it touches. */
export interface PriceRise extends Rise {
  itemId: string;
  item: ItemRow;
  /** Every size on every channel it touches, the most it comes to a month first. */
  touches: PriceTouch[];
  /** What it comes to over a month, at the 30 days' sales: what each serving adds, times those sold. */
  month: number;
}

/**
 * What came in dearer (round five): every item delivered in the `days` to
 * `today`, its latest delivery against the one before, by 5% or more; then,
 * unless only the rises are asked for, every size it touches, on its recipe
 * or through what is made from it, with the margin before and after and the
 * price that keeps it. Needs cost.view.
 */
export async function getPriceRises(
  today: string,
  { days = 30, touches = true }: { days?: number; touches?: boolean } = {},
): Promise<PriceRise[]> {
  const c = await db();
  const since = addDays(today, -days);
  // The deliveries since then (a day's margin either side of the café's midnight), and their items.
  const receipts = rows(
    await c
      .from("goods_receipt")
      .select("id")
      .gte("received_at", `${addDays(since, -1)}T00:00:00Z`)
      .limit(2000),
    "deliveries",
  ).map((r) => str(r.id));
  if (receipts.length === 0) return [];
  const lines = await readInBatches(
    receipts,
    (batch) =>
      c
        .from("goods_receipt_line")
        .select("item_id,goods_receipt_id,id")
        .in("goods_receipt_id", batch)
        .order("id"),
    "delivery lines",
  );
  const itemIds = [...new Set(lines.map((l) => str(l.item_id)))];
  const histories = await Promise.all(itemIds.map((id) => getItemPriceHistory(id)));
  const risen = itemIds.flatMap((id, i) => {
    const r = riseOf(histories[i]!, since);
    return r ? [{ itemId: id, rise: r }] : [];
  });
  if (risen.length === 0) return [];

  const items = new Map((await getItems()).map((i) => [i.id, i]));
  const found = risen.filter((r) => items.has(r.itemId));
  if (!touches)
    return found.map((r) => ({
      ...r.rise,
      itemId: r.itemId,
      item: items.get(r.itemId)!,
      touches: [],
      month: 0,
    }));

  const [menu, recipeLines, made, costs, sold] = await Promise.all([
    getMenuCosting(),
    getMenuRecipeLines(),
    getBatchRecipes(),
    getItemCosts(),
    getSalesAnalysis({
      from: addDays(today, -29),
      to: today,
      by: "size",
      then: "channel",
      channel: null,
      location: null,
      category: null,
      cashier: null,
    }),
  ]);
  const factor = (itemId: string, unitCode: string): number | null => {
    const it = items.get(itemId);
    if (!it) return null;
    if (unitCode === it.baseUnit) return 1;
    return it.units.find((u) => u.code === unitCode)?.factor ?? null;
  };
  const recipes = made
    .filter((r) => r.isActive)
    .map((r) => ({
      outputItemId: r.outputItemId,
      yieldBase: r.yieldBase,
      lines: r.lines.map((l) => ({ itemId: l.itemId, baseQty: l.baseQty })),
    }));
  const lineRows = recipeLines.map((l) => ({
    variantId: l.variantId,
    itemId: l.itemId,
    quantity: l.quantity,
    unitCode: l.unitCode,
    channels: l.channels,
  }));
  const soldOf = new Map(sold.rows.map((r) => [`${r.key}|${r.key2 ?? ""}`, r.qty]));
  const channels = [...new Set(menu.map((m) => m.channel))];

  return found
    .map(({ itemId, rise }) => {
      const now = costs.get(itemId);
      const itemCostNow = now === undefined ? null : Number(now);
      const list: PriceTouch[] = [];
      for (const ch of channels) {
        const uses = servingUses(itemId, lineRows, recipes, factor, ch);
        for (const m of menu) {
          if (m.channel !== ch || m.unitCost === null) continue;
          const use = uses.get(m.variantId);
          if (!use) continue;
          list.push({
            ...touch(rise, use, m.price, m.unitCost, itemCostNow),
            variantId: m.variantId,
            channel: ch,
            product: m.productName,
            size: m.variantName,
            sold: soldOf.get(`${m.variantId}|${ch}`) ?? 0,
          });
        }
      }
      list.sort(
        (a, b) =>
          b.adds * b.sold - a.adds * a.sold ||
          a.product.localeCompare(b.product) ||
          a.channel.localeCompare(b.channel),
      );
      return {
        ...rise,
        itemId,
        item: items.get(itemId)!,
        touches: list,
        month: list.reduce((s, t) => s + t.adds * t.sold, 0),
      };
    })
    .sort((a, b) => b.month - a.month || b.change - a.change);
}
