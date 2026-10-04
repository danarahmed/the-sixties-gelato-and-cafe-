import "server-only";
import { db, rows, str } from "@/lib/db/client";
import { readInBatches } from "@/lib/db/batches";
import { getItems, type ItemRow } from "@/lib/db/read";
import { getItemCosts, getMenuCosting, getMenuRecipeLines } from "@/lib/db/reports";
import { getBatchRecipes } from "@/lib/db/production";
import { getSalesAnalysis } from "@/lib/db/analysis";
import { addDays } from "@/lib/dates";
import { riseOf, servingUses, touch, type Delivered, type Rise, type Touch } from "@/lib/prices";

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
  const deliveries = await deliveriesOf(c, since);
  const risen = [...deliveries].flatMap(([itemId, history]) => {
    const r = riseOf(history, since);
    return r ? [{ itemId, rise: r }] : [];
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

type Db = Awaited<ReturnType<typeof db>>;

/** How far back a delivery is looked for to set the latest against. */
const LOOK_BACK_DAYS = 180;

/**
 * Each item delivered since `since`: its deliveries over the half-year before,
 * newest first, each at what a base unit cost as the delivery stands now, the
 * freight shared out — as the price history (item_price_history) has them,
 * read in one pass: a delivery as made is the stock it put in (0038's
 * original state), and one corrected is its latest correction's state; one
 * taken back whole is none. The price history works through every delivery
 * ever made, an item at a time: too slow for every dashboard.
 */
async function deliveriesOf(c: Db, since: string): Promise<Map<string, Delivered[]>> {
  const from = (day: string) => `${addDays(day, -1)}T00:00:00Z`;
  // The items delivered lately (a day's margin for the café's midnight).
  const lately = rows(
    await c
      .from("inventory_movement")
      .select("item_id")
      .eq("type", "purchase_receipt")
      .gte("occurred_at", from(since))
      .limit(5000),
    "the stock deliveries put in",
  );
  const itemIds = [...new Set(lately.map((m) => str(m.item_id)))];
  if (itemIds.length === 0) return new Map();
  const moves = await readInBatches(
    itemIds,
    (batch) =>
      c
        .from("inventory_movement")
        .select("id,item_id,reference_id,base_quantity_signed,value,occurred_at")
        .eq("type", "purchase_receipt")
        .eq("reference_type", "goods_receipt")
        .in("item_id", batch)
        .gte("occurred_at", from(addDays(since, -LOOK_BACK_DAYS)))
        .order("item_id")
        .order("id"),
    "the stock deliveries put in",
  );
  const receiptIds = [...new Set(moves.map((m) => str(m.reference_id)))];
  const [corrections, receipts, suppliers] = await Promise.all([
    readInBatches(
      receiptIds,
      (batch) =>
        c
          .from("receipt_correction")
          .select("id,goods_receipt_id,correction_no,after_state")
          .in("goods_receipt_id", batch)
          .order("goods_receipt_id")
          .order("id"),
      "deliveries' corrections",
    ),
    readInBatches(
      receiptIds,
      (batch) => c.from("goods_receipt").select("id,supplier_id").in("id", batch).order("id"),
      "deliveries",
    ),
    c.from("supplier").select("id,name"),
  ]);
  // A delivery corrected stands as its latest correction left it.
  const latest = new Map<string, { no: number; state: Record<string, unknown> }>();
  for (const x of corrections) {
    const no = Number(x.correction_no);
    const was = latest.get(str(x.goods_receipt_id));
    if (!was || no > was.no)
      latest.set(str(x.goods_receipt_id), {
        no,
        state: (x.after_state ?? {}) as Record<string, unknown>,
      });
  }
  const supplierName = new Map(rows(suppliers, "suppliers").map((x) => [str(x.id), str(x.name)]));
  const supplierOf = new Map(
    receipts.map((r) => [str(r.id), r.supplier_id ? str(r.supplier_id) : null]),
  );

  // Each delivery of each item: its base quantity and what it put in, freight and all.
  const each = new Map<
    string,
    { itemId: string; receipt: string; at: string; qty: number; value: number }
  >();
  for (const m of moves) {
    const key = `${str(m.reference_id)}|${str(m.item_id)}`;
    const d = each.get(key) ?? {
      itemId: str(m.item_id),
      receipt: str(m.reference_id),
      at: str(m.occurred_at),
      qty: 0,
      value: 0,
    };
    d.qty += Number(m.base_quantity_signed);
    d.value += Number(m.value);
    each.set(key, d);
  }
  const out = new Map<string, Delivered[]>();
  for (const d of each.values()) {
    let { qty, value, at } = d;
    let supplier = supplierOf.get(d.receipt) ?? null;
    const fixed = latest.get(d.receipt)?.state;
    if (fixed) {
      if (fixed.reversed === true) continue;
      const lines = (Array.isArray(fixed.lines) ? fixed.lines : []) as Record<string, unknown>[];
      const mine = lines.filter((l) => str(l.item_id) === d.itemId);
      qty = mine.reduce((n, l) => n + Number(l.base_qty ?? 0), 0);
      value = mine.reduce((n, l) => n + Number(l.landed ?? l.goods_value ?? 0), 0);
      // The day it came, as a correction set it, at the hour it was entered.
      if (typeof fixed.received_on === "string" && /^\d{4}-\d{2}-\d{2}$/.test(fixed.received_on))
        at = `${fixed.received_on}${at.slice(10)}`;
      if (fixed.supplier_id) supplier = str(fixed.supplier_id);
    }
    const unit = qty > 0 ? value / qty : null;
    const list = out.get(d.itemId) ?? [];
    list.push({
      receivedAt: at,
      supplier: supplier ? (supplierName.get(supplier) ?? null) : null,
      costPerBase: unit,
      landedPerBase: unit,
    });
    out.set(d.itemId, list);
  }
  for (const list of out.values()) list.sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
  return out;
}
