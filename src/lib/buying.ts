/**
 * The buying list (0045, release T), as the screen handles it: each item's
 * figures and why it is, or is not, to be ordered; the lines chosen, grouped
 * by supplier; and a line moved to another supplier's pack. Pure: the screen
 * and the tests read through here. The database works out every figure, and
 * the orders it drafts are checked again as save_po checks any order.
 */
import Decimal from "decimal.js";
import { fill, type T } from "@/lib/i18n/core";
import { fmtIQD, fmtQty } from "@/lib/format";
import { orderTotal } from "@/lib/purchasing";

/** To order; enough on hand and coming; too new to judge; not used lately. */
export type BuyStatus = "order" | "enough" | "no_history" | "not_used";
/** The reorder level: the item's own, or worked out from its use. */
export type ReorderFrom = "item" | "use";
/** What it is ordered up to: its par level, the most it holds, a week of use more, or the reorder level. */
export type TargetFrom = "par" | "max" | "week" | "reorder";
/** Why this supplier: the item's usual one, its last delivery's, or the one it was last set with. */
export type SupplierFrom = "usual" | "last_delivery" | "set";
/** Where a pack's price comes from: agreed last, the last delivery, what the item costs now. */
export type PriceFrom = "agreed" | "delivery" | "cost";

export interface SupplierChoice {
  supplierId: string;
  supplier: string;
  usual: boolean;
  /** The days its deliveries take; null when it has none of its own. */
  leadTime: number | null;
  packUnit: string;
  /** What a pack holds of the item's base unit. */
  packFactor: number;
  /** A pack's price, when there is one. */
  price: number | null;
  priceFrom: PriceFrom | null;
  priceOn: string | null;
}

export interface BuyingLine {
  itemId: string;
  item: string;
  baseUnit: string;
  itemType: string;
  status: BuyStatus;
  onHand: number;
  onOrder: number;
  inDraft: number;
  /** Sent here from another of the café's places, on its way (0055). */
  onWay: number;
  /** On hand, on order, in draft and on its way: what the item has and has coming. */
  position: number;
  /** The open orders it is on, with what each still waits for (base unit). */
  orders: { poId: string; poNo: number; status: string; baseQty: number }[];
  /** Days since it was first at the location; null when it never was. */
  historyDays: number | null;
  /** The days its use is judged over: 28, or its history when shorter. */
  days: number | null;
  used: number;
  dailyUse: number | null;
  leadTime: number;
  leadFrom: "supplier" | "cafe";
  reorderLevel: number | null;
  reorderFrom: ReorderFrom | null;
  safetyStock: number | null;
  targetLevel: number | null;
  targetFrom: TargetFrom | null;
  supplierId: string | null;
  supplier: string | null;
  supplierFrom: SupplierFrom | null;
  packUnit: string;
  packFactor: number;
  /** Packs suggested (0 when nothing is to order), and what they hold in the base unit. */
  packs: number;
  qtyBase: number;
  price: number | null;
  priceFrom: PriceFrom | null;
  priceOn: string | null;
  /** Every supplier it can come from, the suggested one first. */
  choices: SupplierChoice[];
}

export interface BuyingList {
  locationId: string;
  location: string;
  asOf: string;
  /** The days use is judged over at most (28). */
  windowDays: number;
  /** The café's own delivery days, for a supplier with none. */
  leadTime: number;
  items: BuyingLine[];
}

/** Each status, as the screen names it (a phrase, said through t()). */
export const STATUS_LABEL: Record<BuyStatus, string> = {
  order: "To order",
  enough: "Enough",
  no_history: "Not enough history",
  not_used: "Not used lately",
};

/** Every phrase above, for the check that each is in every language. */
export const BUYING_PHRASES: readonly string[] = Object.values(STATUS_LABEL);

const num = (v: unknown): number => (v === null || v === undefined || v === "" ? 0 : Number(v));
const numOrNull = (v: unknown): number | null =>
  v === null || v === undefined || v === "" ? null : Number(v);
const str = (v: unknown): string => (v === null || v === undefined ? "" : String(v));
const strOrNull = (v: unknown): string | null =>
  v === null || v === undefined || v === "" ? null : String(v);
const list = (v: unknown): Record<string, unknown>[] =>
  Array.isArray(v) ? (v as Record<string, unknown>[]) : [];
function oneOf<K extends string>(v: unknown, keys: readonly K[]): K | null {
  return keys.includes(v as K) ? (v as K) : null;
}

const STATUSES = ["order", "enough", "no_history", "not_used"] as const;
const PRICE_FROM = ["agreed", "delivery", "cost"] as const;

function choiceFrom(c: Record<string, unknown>): SupplierChoice {
  return {
    supplierId: str(c.supplier_id),
    supplier: str(c.supplier),
    usual: c.usual === true,
    leadTime: numOrNull(c.lead_time),
    packUnit: str(c.pack_unit),
    packFactor: num(c.pack_factor) || 1,
    price: numOrNull(c.price),
    priceFrom: oneOf(c.price_from, PRICE_FROM),
    priceOn: strOrNull(c.price_on),
  };
}

export function buyingLineFrom(r: Record<string, unknown>): BuyingLine {
  return {
    itemId: str(r.item_id),
    item: str(r.item),
    baseUnit: str(r.base_unit),
    itemType: str(r.item_type),
    status: oneOf(r.status, STATUSES) ?? "enough",
    onHand: num(r.on_hand),
    onOrder: num(r.on_order),
    inDraft: num(r.in_draft),
    onWay: num(r.on_way),
    position: num(r.position),
    orders: list(r.orders).map((o) => ({
      poId: str(o.po_id),
      poNo: num(o.po_no),
      status: str(o.status),
      baseQty: num(o.base_qty),
    })),
    historyDays: numOrNull(r.history_days),
    days: numOrNull(r.days),
    used: num(r.used),
    dailyUse: numOrNull(r.daily_use),
    leadTime: num(r.lead_time),
    leadFrom: r.lead_from === "supplier" ? "supplier" : "cafe",
    reorderLevel: numOrNull(r.reorder_level),
    reorderFrom: oneOf(r.reorder_from, ["item", "use"] as const),
    safetyStock: numOrNull(r.safety_stock),
    targetLevel: numOrNull(r.target_level),
    targetFrom: oneOf(r.target_from, ["par", "max", "week", "reorder"] as const),
    supplierId: strOrNull(r.supplier_id),
    supplier: strOrNull(r.supplier),
    supplierFrom: oneOf(r.supplier_from, ["usual", "last_delivery", "set"] as const),
    packUnit: str(r.pack_unit) || str(r.base_unit),
    packFactor: num(r.pack_factor) || 1,
    packs: num(r.packs),
    qtyBase: num(r.qty_base),
    price: numOrNull(r.price),
    priceFrom: oneOf(r.price_from, PRICE_FROM),
    priceOn: strOrNull(r.price_on),
    choices: list(r.choices).map(choiceFrom),
  };
}

export function buyingListFrom(r: Record<string, unknown> | null | undefined): BuyingList {
  const o = r ?? {};
  return {
    locationId: str(o.location_id),
    location: str(o.location),
    asOf: str(o.as_of),
    windowDays: num(o.window_days) || 28,
    leadTime: num(o.lead_time),
    items: list(o.items).map(buyingLineFrom),
  };
}

/** What is still needed to reach the level it is ordered up to, in the base unit; 0 when none. */
export function needOf(line: Pick<BuyingLine, "targetLevel" | "position">): number {
  if (line.targetLevel === null) return 0;
  return Math.max(new Decimal(line.targetLevel).minus(line.position).toNumber(), 0);
}

/** Whole packs to cover a need: rounded up, one at least. */
export function packsFor(needBase: number, factor: number): number {
  const f = factor > 0 ? factor : 1;
  return Math.max(new Decimal(needBase).div(f).ceil().toNumber(), 1);
}

/**
 * A line's quantity in another pack, when its supplier or pack is changed:
 * what it needs, in whole packs of that size; one pack for an item added by
 * hand, which the list does not suggest.
 */
export function packsIn(
  line: Pick<BuyingLine, "status" | "targetLevel" | "position">,
  factor: number,
): number {
  return line.status === "order" ? packsFor(needOf(line), factor) : 1;
}

/** A line as the buyer leaves it on the screen. */
export interface LineDraft {
  itemId: string;
  include: boolean;
  qty: string;
  unit: string;
  price: string;
  supplierId: string;
  usual: boolean;
}

/** The list's own suggestion for a line: what it says to order, from whom, in what pack. */
export function draftOf(line: BuyingLine): LineDraft {
  return {
    itemId: line.itemId,
    include: line.status === "order",
    qty: String(line.status === "order" ? line.packs : 1),
    unit: line.packUnit,
    price: line.price === null ? "" : String(line.price),
    supplierId: line.supplierId ?? "",
    usual: false,
  };
}

/**
 * A line moved to another supplier: that supplier's pack, the quantity in it,
 * and its price, where it has them; else the line stays as it is, for its
 * price to be checked.
 */
export function withSupplier(line: BuyingLine, draft: LineDraft, supplierId: string): LineDraft {
  const c = line.choices.find((x) => x.supplierId === supplierId);
  if (!c) return { ...draft, supplierId };
  return {
    ...draft,
    supplierId,
    unit: c.packUnit,
    qty: String(packsIn(line, c.packFactor)),
    price: c.price === null ? draft.price : String(c.price),
  };
}

/** The drafts chosen, by supplier: each with its lines and total, those with no supplier last. */
export function bySupplier<D extends { supplierId: string; qty: number; unitPrice: number }>(
  lines: D[],
  names: Map<string, string>,
): { supplierId: string; supplier: string | null; lines: D[]; total: number }[] {
  const groups = new Map<string, D[]>();
  for (const l of lines) groups.set(l.supplierId, [...(groups.get(l.supplierId) ?? []), l]);
  return [...groups.entries()]
    .map(([supplierId, ls]) => ({
      supplierId,
      supplier: supplierId ? (names.get(supplierId) ?? null) : null,
      lines: ls,
      total: orderTotal(ls),
    }))
    .sort((a, b) =>
      a.supplierId === ""
        ? 1
        : b.supplierId === ""
          ? -1
          : (a.supplier ?? "").localeCompare(b.supplier ?? ""),
    );
}

const english: T = (key, vars) => fill(key, vars);

/** A pack's price: whole dinars as money is shown, a fraction of one (a millilitre's) as it is. */
export function fmtPrice(n: number): string {
  return Number.isInteger(n) ? fmtIQD(n) : `${fmtQty(n)} IQD`;
}

/**
 * Why a line is, or is not, to be ordered, in sentences with its numbers:
 * what it has and has coming against its reorder level, where that level
 * comes from, what it is ordered up to, the packs, the supplier and the price.
 */
export function reasonsOf(
  line: BuyingLine,
  t: T = english,
  packName: (code: string) => string = (code) => code,
): string[] {
  const u = line.baseUnit;
  const q = (n: number) => `${fmtQty(n)} ${u}`;
  const out: string[] = [];
  if (line.status === "no_history") {
    out.push(
      line.historyDays === null
        ? t("Never in stock here: there is no use to judge by.")
        : t("Only {n} day(s) of history: 7 are needed to judge its use by.", {
            n: line.historyDays,
          }),
      t("Set a reorder level on the item, or add it to an order yourself."),
    );
    return out;
  }
  if (line.status === "not_used") {
    out.push(t("Not used in the last {n} days: nothing is needed.", { n: line.days ?? 0 }));
    return out;
  }
  out.push(
    line.onWay > 0
      ? t(
          "{have} on hand, {ordered} on order, {draft} in draft orders and {way} on its way from another place: {all} in all.",
          {
            have: q(line.onHand),
            ordered: q(line.onOrder),
            draft: q(line.inDraft),
            way: q(line.onWay),
            all: q(line.position),
          },
        )
      : line.onOrder === 0 && line.inDraft === 0
        ? t("{have} on hand.", { have: q(line.onHand) })
        : t("{have} on hand, {ordered} on order and {draft} in draft orders: {all} in all.", {
            have: q(line.onHand),
            ordered: q(line.onOrder),
            draft: q(line.inDraft),
            all: q(line.position),
          }),
  );
  const level = q(line.reorderLevel ?? 0);
  if (line.reorderFrom === "item")
    out.push(
      line.status === "order"
        ? t("Below its reorder level, set on the item: {level}.", { level })
        : t("At or above its reorder level, set on the item: {level}.", { level }),
    );
  else {
    out.push(
      t(
        "About {daily} a day over the last {days} days; a delivery takes {lead} day(s), and a day more: {level} is its reorder level.",
        { daily: q(line.dailyUse ?? 0), days: line.days ?? 0, lead: line.leadTime, level },
      ),
    );
    if (line.safetyStock)
      out.push(t("With a safety stock of {qty}.", { qty: q(line.safetyStock) }));
    out.push(
      line.status === "order"
        ? t("Below it: to order.")
        : t("At or above it: nothing to order yet."),
    );
  }
  if (line.status !== "order") return out;
  const target = q(line.targetLevel ?? 0);
  out.push(
    line.targetFrom === "par"
      ? t("Ordered up to its par level, {target}.", { target })
      : line.targetFrom === "max"
        ? t("Ordered up to the most it holds, {target}.", { target })
        : line.targetFrom === "week"
          ? t("Ordered up to the reorder level and a week of use: {target}.", { target })
          : t(
              "Ordered up to its reorder level, {target}: a par level on the item orders more at once.",
              {
                target,
              },
            ),
  );
  out.push(
    line.packFactor === 1
      ? t("{qty} to order.", { qty: q(line.qtyBase) })
      : t("{packs} × {pack} ({qty}), rounded up to whole packs.", {
          packs: line.packs,
          pack: packName(line.packUnit),
          qty: q(line.qtyBase),
        }),
  );
  return out;
}

/** Where the suggested supplier and price come from, in words. */
export function sourceOf(line: BuyingLine, t: T = english): string[] {
  const out: string[] = [];
  out.push(
    line.supplierFrom === "usual"
      ? t("Its usual supplier.")
      : line.supplierFrom === "last_delivery"
        ? t("The supplier of its last delivery.")
        : line.supplierFrom === "set"
          ? t("The supplier it was last set with.")
          : t("No supplier yet: choose one."),
  );
  if (line.price !== null)
    out.push(
      line.priceFrom === "agreed"
        ? t("{price} a pack, agreed {day}.", {
            price: fmtPrice(line.price),
            day: line.priceOn ?? "",
          })
        : line.priceFrom === "delivery"
          ? t("{price} a pack, as delivered {day}.", {
              price: fmtPrice(line.price),
              day: line.priceOn ?? "",
            })
          : t("{price} a pack, from what it costs now: check it with the supplier.", {
              price: fmtPrice(line.price),
            }),
    );
  else out.push(t("No price yet: enter one."));
  return out;
}

const decimal = (s: string): Decimal | null => {
  const v = s.replace(/[\s,]/g, "");
  return /^\d+(\.\d+)?$/.test(v) ? new Decimal(v) : null;
};

/**
 * A line put in another of the item's packs: a pack's price in it, and the
 * quantity, what the item needs in whole packs of it where the list suggests
 * it, or as much as before, rounded up to whole packs, where it was added by
 * hand.
 */
export function inPack(
  line: Pick<BuyingLine, "status" | "targetLevel" | "position">,
  draft: LineDraft,
  unit: string,
  units: { code: string; factor: number }[],
): LineDraft {
  const from = units.find((u) => u.code === draft.unit)?.factor ?? 1;
  const to = units.find((u) => u.code === unit)?.factor ?? 1;
  const price = decimal(draft.price);
  const qty = decimal(draft.qty);
  return {
    ...draft,
    unit,
    price:
      price === null ? draft.price : String(price.div(from).mul(to).toDecimalPlaces(2).toNumber()),
    qty:
      line.status === "order"
        ? String(packsIn(line, to))
        : qty === null
          ? draft.qty
          : String(Math.max(qty.mul(from).div(to).ceil().toNumber(), 1)),
  };
}

/** What the list stands on: when it changes (orders drafted, stock moved), the screen starts again from it. */
export function listStamp(list: BuyingList): string {
  return list.items
    .map((l) => `${l.itemId}:${l.status}:${l.position}:${l.packs}:${l.supplierId ?? ""}`)
    .join("|");
}
