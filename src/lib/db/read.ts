import "server-only";
/**
 * Reads for the operational screens. Every query runs as the signed-in
 * person: row-level security returns only their business's rows, and only
 * the rows their role may see (costs and the ledger need cost.view). Nothing
 * here filters by business itself — the database does, and cannot be talked
 * out of it.
 *
 * A failed read throws, and the screen says it could not load. It never
 * returns an empty list that would look like "nothing recorded yet".
 */
import { db, num, numOrNull, rows, str, strOrNull, one, type Row } from "./client";
import { likeText, type SaleQuery } from "@/lib/findSale";
import { leftToGiveBack, type LeftToGiveBack, type PaidPart, type PayType } from "@/lib/payments";

export interface BusinessConfig {
  id: string;
  name: string;
  currencyCode: string;
  currencyDecimals: number;
  timezone: string;
  defaultLocale: string;
  preventNegativeStock: boolean;
  wasteApprovalThreshold: number;
  /** A percentage discount comes to the nearest multiple of this. */
  discountRoundTo: number;
  /** Above this share of the bill a discount needs a manager's approval (0028). */
  discountCapPercent: number;
  /** The café's own bill numbers start with this: SGC-2026-0001. */
  billPrefix: string;
}

export async function getBusinessConfig(): Promise<BusinessConfig | null> {
  const c = await db();
  const b = one(
    await c
      .from("business")
      .select(
        "id,name,currency_code,currency_decimals,timezone,default_locale,prevent_negative_stock,waste_approval_threshold,discount_round_to,discount_cap_percent,bill_prefix",
      )
      .maybeSingle(),
    "the business settings",
  );
  if (!b) return null;
  return {
    id: str(b.id),
    name: str(b.name),
    currencyCode: str(b.currency_code),
    currencyDecimals: num(b.currency_decimals),
    timezone: str(b.timezone),
    defaultLocale: str(b.default_locale),
    preventNegativeStock: Boolean(b.prevent_negative_stock),
    wasteApprovalThreshold: num(b.waste_approval_threshold),
    discountRoundTo: num(b.discount_round_to),
    discountCapPercent: num(b.discount_cap_percent),
    billPrefix: str(b.bill_prefix),
  };
}

export interface LocationRow {
  id: string;
  name: string;
  kind: string;
  isActive: boolean;
}

export async function getLocations(): Promise<LocationRow[]> {
  const c = await db();
  return rows(
    await c.from("location").select("id,name,kind,is_active").order("created_at"),
    "locations",
  ).map((l) => ({
    id: str(l.id),
    name: str(l.name),
    kind: str(l.kind),
    isActive: Boolean(l.is_active),
  }));
}

export interface UnitOption {
  code: string;
  label: string;
  factor: number;
}

export interface ItemRow {
  id: string;
  name: string;
  nameAr: string | null;
  nameCkb: string | null;
  itemType: string;
  baseUnit: string;
  dimension: string;
  minLevelBase: number | null;
  /** The base unit first, then any pack sizes (kg, case of 24, …). */
  units: UnitOption[];
}

export interface ItemDetail {
  id: string;
  name: string;
  nameAr: string | null;
  nameCkb: string | null;
  itemType: string;
  baseUnit: string;
  dimension: string;
  minLevelBase: number | null;
  parLevelBase: number | null;
  isActive: boolean;
  /** The base unit first, then its pack sizes. */
  units: UnitOption[];
}

/** One item by id, in use or not, with its units (for its stock card). */
export async function getItem(id: string): Promise<ItemDetail | null> {
  const c = await db();
  const [items, units] = await Promise.all([
    c
      .from("item")
      .select(
        "id,name,name_ar,name_ckb,item_type,base_unit_code,dimension,min_level_base,par_level_base,is_active",
      )
      .eq("id", id)
      .limit(1),
    c
      .from("item_unit")
      .select("code,label,factor_to_base")
      .eq("item_id", id)
      .order("factor_to_base"),
  ]);
  const r = rows(items, "the item")[0];
  if (!r) return null;
  const base = str(r.base_unit_code);
  return {
    id: str(r.id),
    name: str(r.name),
    nameAr: strOrNull(r.name_ar),
    nameCkb: strOrNull(r.name_ckb),
    itemType: str(r.item_type),
    baseUnit: base,
    dimension: str(r.dimension),
    minLevelBase: numOrNull(r.min_level_base),
    parLevelBase: numOrNull(r.par_level_base),
    isActive: Boolean(r.is_active),
    units: [
      { code: base, label: base, factor: 1 },
      ...rows(units, "the item's units")
        .filter((u) => str(u.code) !== base)
        .map((u) => ({ code: str(u.code), label: str(u.label), factor: num(u.factor_to_base) })),
    ],
  };
}

export interface PriceHistoryRow {
  receivedAt: string;
  receiptNo: number | null;
  supplier: string | null;
  qty: number;
  unit: string;
  goodsValue: number;
  /** What was paid, per base unit. */
  costPerBase: number | null;
  /** With freight and other costs shared out, per base unit. */
  landedPerBase: number | null;
}

/** What an item has cost, delivery by delivery, newest first (0027; needs cost.view). */
export async function getItemPriceHistory(itemId: string): Promise<PriceHistoryRow[]> {
  const c = await db();
  return rows(
    await c.rpc("item_price_history", { p_item: itemId }),
    "the item's price history",
  ).map((r) => ({
    receivedAt: str(r.received_at),
    receiptNo: r.receipt_no == null ? null : num(r.receipt_no),
    supplier: strOrNull(r.supplier),
    qty: num(r.qty),
    unit: str(r.unit),
    goodsValue: num(r.goods_value),
    costPerBase: numOrNull(r.cost_per_base),
    landedPerBase: numOrNull(r.landed_per_base),
  }));
}

export async function getItems(): Promise<ItemRow[]> {
  const c = await db();
  const [items, units] = await Promise.all([
    c
      .from("item")
      .select("id,name,name_ar,name_ckb,item_type,base_unit_code,dimension,min_level_base")
      .eq("is_active", true)
      .order("name"),
    c.from("item_unit").select("item_id,code,label,factor_to_base").order("factor_to_base"),
  ]);
  const byItem = new Map<string, UnitOption[]>();
  for (const u of rows(units, "item units")) {
    const list = byItem.get(str(u.item_id)) ?? [];
    list.push({ code: str(u.code), label: str(u.label), factor: num(u.factor_to_base) });
    byItem.set(str(u.item_id), list);
  }
  return rows(items, "items").map((i) => {
    const base = str(i.base_unit_code);
    const extra = (byItem.get(str(i.id)) ?? []).filter((u) => u.code !== base);
    return {
      id: str(i.id),
      name: str(i.name),
      nameAr: strOrNull(i.name_ar),
      nameCkb: strOrNull(i.name_ckb),
      itemType: str(i.item_type),
      baseUnit: base,
      dimension: str(i.dimension),
      minLevelBase: numOrNull(i.min_level_base),
      units: [{ code: base, label: base, factor: 1 }, ...extra],
    };
  });
}

/** Items taken out of use (0027): kept for their history, and to be brought back. */
export async function getItemsOutOfUse(): Promise<{ id: string; name: string }[]> {
  const c = await db();
  return rows(
    await c.from("item").select("id,name").eq("is_active", false).order("name"),
    "items out of use",
  ).map((i) => ({ id: str(i.id), name: str(i.name) }));
}

export interface StockRow {
  itemId: string;
  name: string;
  itemType: string;
  unit: string;
  onHandBase: number;
  value: number;
  unitCost: number | null;
  reorderBase: number | null;
  isLow: boolean;
  isNegative: boolean;
}

/**
 * Stock on hand, derived from the movement ledger (needs cost.view): at one
 * place, or — no place named — all the café holds of each item, one row an
 * item, below zero when it is below zero anywhere (release AB).
 */
export async function getStockBoard(place: string | null = null): Promise<StockRow[]> {
  const c = await db();
  let q = c
    .from("stock_board")
    .select(
      "item_id,location_id,name,item_type,base_unit_code,quantity_base,value,unit_cost,min_level_base,is_low,is_negative",
    );
  if (place) q = q.eq("location_id", place);
  const list = rows(await q.order("name"), "stock on hand").map((r) => ({
    itemId: str(r.item_id),
    name: str(r.name),
    itemType: str(r.item_type),
    unit: str(r.base_unit_code),
    onHandBase: num(r.quantity_base),
    value: num(r.value),
    unitCost: numOrNull(r.unit_cost),
    reorderBase: numOrNull(r.min_level_base),
    isLow: Boolean(r.is_low),
    isNegative: Boolean(r.is_negative),
  }));
  if (place) return list;
  const byItem = new Map<string, StockRow>();
  for (const r of list) {
    const was = byItem.get(r.itemId);
    if (!was) {
      byItem.set(r.itemId, { ...r });
      continue;
    }
    was.onHandBase += r.onHandBase;
    was.value += r.value;
    was.isNegative ||= r.isNegative;
  }
  return [...byItem.values()].map((r) => ({
    ...r,
    unitCost: r.onHandBase > 0 ? Math.round((r.value / r.onHandBase) * 10000) / 10000 : null,
    isLow: r.onHandBase < (r.reorderBase ?? 0),
  }));
}

export interface MovementRow {
  id: string;
  itemName: string;
  type: string;
  qty: number;
  unitCost: number | null;
  value: number | null;
  reason: string | null;
  occurredAt: string;
  by: string | null;
}

/** The latest stock movements, at one place or at all of them. */
export async function getMovements(
  limit = 100,
  place: string | null = null,
): Promise<MovementRow[]> {
  const c = await db();
  let q = c
    .from("inventory_movement")
    .select("id,item_id,type,base_quantity_signed,unit_cost,value,reason,occurred_at,app_user_id");
  if (place) q = q.eq("location_id", place);
  const [moves, items, people] = await Promise.all([
    q.order("occurred_at", { ascending: false }).limit(limit),
    c.from("item").select("id,name"),
    c.from("app_user").select("id,full_name"),
  ]);
  const itemName = new Map(rows(items, "items").map((i) => [str(i.id), str(i.name)]));
  const person = new Map(rows(people, "people").map((p) => [str(p.id), str(p.full_name)]));
  return rows(moves, "stock movements").map((m) => ({
    id: str(m.id),
    itemName: itemName.get(str(m.item_id)) ?? "—",
    type: str(m.type),
    qty: num(m.base_quantity_signed),
    unitCost: numOrNull(m.unit_cost),
    value: numOrNull(m.value),
    reason: strOrNull(m.reason),
    occurredAt: str(m.occurred_at),
    by: m.app_user_id ? (person.get(str(m.app_user_id)) ?? null) : null,
  }));
}

export interface SupplierRow {
  id: string;
  name: string;
  contact: string | null;
  phone: string | null;
}

export async function getSuppliers(): Promise<SupplierRow[]> {
  const c = await db();
  return rows(
    await c.from("supplier").select("id,name,contact,phone").eq("is_active", true).order("name"),
    "suppliers",
  ).map((s) => ({
    id: str(s.id),
    name: str(s.name),
    contact: strOrNull(s.contact),
    phone: strOrNull(s.phone),
  }));
}

export interface ReceiptRow {
  id: string;
  receiptNo: number | null;
  receivedAt: string;
  supplierId: string | null;
  supplierName: string | null;
  goodsValue: number;
  landedExtras: number;
  /** What the receipt put into Inventory — and into GRNI, for its bill to clear. */
  value: number;
  lineCount: number;
  billed: boolean;
  /**
   * Has a journal to bill against and no bill yet: goods received not invoiced
   * (the new app), or the payable the old app posted straight to Accounts
   * payable when the goods arrived.
   */
  billable: boolean;
  /** Received before the controls. The old app kept the supplier's name in the note. */
  legacy: boolean;
  /** Received before the controls and never journaled: the owner posts it from Reports. */
  unjournaled: boolean;
  note: string | null;
  /** The day it came, as a correction set it (0038); null: the day it was entered. */
  receivedOn: string | null;
  /** Reversed: it should never have been entered (0038). */
  reversed: boolean;
  /** Its lines as they stand now, corrected or not. */
  lines: { lineId: string; itemId: string; qty: number; unitCode: string; goodsValue: number }[];
  /** Its corrections (0038), in order. */
  corrections: {
    no: number;
    kinds: string[];
    reason: string;
    by: string | null;
    at: string;
    journalNo: number | null;
    stock: number;
    grni: number;
    variance: number;
  }[];
}

export async function getReceipts(limit = 50): Promise<ReceiptRow[]> {
  const c = await db();
  const receipts = rows(
    await c
      .from("goods_receipt")
      .select(
        "id,receipt_no,received_at,supplier_id,freight_total,other_landed_total,rebate_total,note",
      )
      .order("received_at", { ascending: false })
      .limit(limit),
    "goods receipts",
  );
  if (receipts.length === 0) return [];
  const ids = receipts.map((r) => str(r.id));
  const [lines, moves, bills, journals, suppliers, corrections, people] = await Promise.all([
    c
      .from("goods_receipt_line")
      .select("id,goods_receipt_id,item_id,received_qty,received_unit_code,goods_value")
      .in("goods_receipt_id", ids),
    c
      .from("inventory_movement")
      .select("reference_id,value")
      .eq("reference_type", "goods_receipt")
      .eq("type", "purchase_receipt")
      .in("reference_id", ids),
    c
      .from("purchase_invoice")
      .select("goods_receipt_id")
      .is("cancelled_at", null)
      .in("goods_receipt_id", ids),
    c
      .from("journal_entry")
      .select("id,reference_id,legacy")
      .eq("reference_type", "goods_receipt")
      .eq("status", "published")
      .in("reference_id", ids),
    c.from("supplier").select("id,name"),
    c
      .from("receipt_correction")
      .select(
        "goods_receipt_id,correction_no,kinds,reason,after_state,effects,journal_entry_id,created_by,created_at",
      )
      .in("goods_receipt_id", ids)
      .order("correction_no", { ascending: true }),
    c.from("app_user").select("id,full_name"),
  ]);
  const receiptJournals = rows(journals, "receipt journals");
  const reversedIds = new Set(
    rows(
      receiptJournals.length === 0
        ? { data: [], error: null }
        : await c
            .from("journal_entry")
            .select("reverses_entry")
            .in(
              "reverses_entry",
              receiptJournals.map((j) => str(j.id)),
            ),
      "reversed receipt journals",
    ).map((r) => str(r.reverses_entry)),
  );
  const goods = new Map<string, { value: number; count: number }>();
  const originalLines = new Map<string, ReceiptRow["lines"]>();
  for (const l of rows(lines, "receipt lines")) {
    const k = str(l.goods_receipt_id);
    const cur = goods.get(k) ?? { value: 0, count: 0 };
    goods.set(k, { value: cur.value + num(l.goods_value), count: cur.count + 1 });
    originalLines.set(k, [
      ...(originalLines.get(k) ?? []),
      {
        lineId: str(l.id),
        itemId: str(l.item_id),
        qty: num(l.received_qty),
        unitCode: str(l.received_unit_code),
        goodsValue: num(l.goods_value),
      },
    ]);
  }
  const correctionRows = rows(corrections, "delivery corrections");
  const person = new Map(rows(people, "people").map((p) => [str(p.id), str(p.full_name)]));
  const journalNos = new Map<string, number>();
  const correctionJournals = correctionRows.map((x) => x.journal_entry_id).filter(Boolean);
  if (correctionJournals.length > 0) {
    for (const j of rows(
      await c.from("journal_entry").select("id,journal_no").in("id", correctionJournals),
      "correction journals",
    )) {
      journalNos.set(str(j.id), num(j.journal_no));
    }
  }
  const correctedBy = new Map<string, Record<string, unknown>[]>();
  for (const x of correctionRows) {
    const k = str(x.goods_receipt_id);
    correctedBy.set(k, [...(correctedBy.get(k) ?? []), x]);
  }
  const sumOf = (effects: unknown, field: string) =>
    Array.isArray(effects)
      ? (effects as Record<string, unknown>[]).reduce((t, e) => t + num(e[field]), 0)
      : 0;
  const valued = new Map<string, number>();
  for (const m of rows(moves, "receipt movements")) {
    valued.set(str(m.reference_id), (valued.get(str(m.reference_id)) ?? 0) + num(m.value));
  }
  const billed = new Set(rows(bills, "bills").map((b) => str(b.goods_receipt_id)));
  const controlled = new Set(
    receiptJournals.filter((j) => !j.legacy).map((j) => str(j.reference_id)),
  );
  const legacyPosted = new Set(
    receiptJournals
      .filter((j) => j.legacy && !reversedIds.has(str(j.id)))
      .map((j) => str(j.reference_id)),
  );
  const journaled = new Set(receiptJournals.map((j) => str(j.reference_id)));
  const supplierName = new Map(rows(suppliers, "suppliers").map((s) => [str(s.id), str(s.name)]));
  return receipts.map((r) => {
    const id = str(r.id);
    const g = goods.get(id) ?? { value: 0, count: 0 };
    const history = correctedBy.get(id) ?? [];
    // As its latest correction left it (0038), or as it was received.
    const state = (history.at(-1)?.after_state ?? null) as Record<string, unknown> | null;
    const stateLines = Array.isArray(state?.lines)
      ? (state.lines as Record<string, unknown>[])
      : [];
    const supplierId = state ? strOrNull(state.supplier_id) : strOrNull(r.supplier_id);
    const reversed = Boolean(state?.reversed);
    return {
      id,
      receiptNo: numOrNull(r.receipt_no),
      receivedAt: str(r.received_at),
      supplierId,
      supplierName: supplierId ? (supplierName.get(supplierId) ?? null) : null,
      goodsValue: state ? stateLines.reduce((t, l) => t + num(l.goods_value), 0) : g.value,
      landedExtras: num(r.freight_total) + num(r.other_landed_total) - num(r.rebate_total),
      value: state ? stateLines.reduce((t, l) => t + num(l.landed), 0) : (valued.get(id) ?? 0),
      lineCount: state ? stateLines.length : g.count,
      billed: billed.has(id),
      billable: (controlled.has(id) || legacyPosted.has(id)) && !billed.has(id) && !reversed,
      legacy: !controlled.has(id),
      unjournaled: !journaled.has(id),
      note: strOrNull(r.note),
      receivedOn: state ? strOrNull(state.received_on) : null,
      reversed,
      lines: state
        ? stateLines.map((l) => ({
            lineId: str(l.line_id),
            itemId: str(l.item_id),
            qty: num(l.qty),
            unitCode: str(l.unit_code),
            goodsValue: num(l.goods_value),
          }))
        : (originalLines.get(id) ?? []),
      corrections: history.map((x) => ({
        no: num(x.correction_no),
        kinds: Array.isArray(x.kinds) ? (x.kinds as unknown[]).map(String) : [],
        reason: str(x.reason),
        by: x.created_by ? (person.get(str(x.created_by)) ?? null) : null,
        at: str(x.created_at),
        journalNo: x.journal_entry_id ? (journalNos.get(str(x.journal_entry_id)) ?? null) : null,
        stock: sumOf(x.effects, "stock_change"),
        grni: sumOf(x.effects, "grni_change"),
        variance: sumOf(x.effects, "variance"),
      })),
    };
  });
}

export interface OrderRow {
  id: string;
  channel: string;
  status: string;
  net: number;
  cogs: number;
  placedAt: string;
  /** How it was paid: each way once, in the order paid. */
  tenders: string[];
  /** Each payment (0042): its part, and for cash what was handed over and the change. */
  payments: PaidPart[];
  /** What is left of each way it was paid, for a refund to give back (0042). */
  refundLeft: LeftToGiveBack[];
  cashier: string | null;
  lines: {
    id: string;
    name: string;
    qty: number;
    unitPrice: number;
    lineNet: number;
    /** Given back by refunds by the item (0037). */
    refundedQty: number;
    refundedAmount: number;
  }[];
  /** Every refund, and the cost of what went back on the shelf. */
  refunded: number;
  costReturned: number;
  /** Refunds by the item (0037), in order. */
  refunds: {
    no: number;
    amount: number;
    at: string;
    reason: string | null;
    tender: string | null;
    /** Each way it went back (0042). */
    tenders: { type: string; amount: number }[];
    by: string | null;
    approvedBy: string | null;
    lines: { name: string; qty: number; amount: number }[];
  }[];
  adjustments: {
    kind: string;
    amount: number;
    reason: string | null;
    at: string;
    /** Who asked for it, and who approved it when a second person did (0028). */
    by: string | null;
    approvedBy: string | null;
  }[];
}

/**
 * The sales Find a sale names (needs cost.view; a customer's sales also need
 * customer.view): by the receipt's sale number, a journal of the sale or of a
 * refund of it, a refund's number, the platform's order number, or the
 * customer. The ids of at most `limit` of each kind; the screen reads them.
 */
export async function findSaleIds(query: SaleQuery, limit = 50): Promise<string[]> {
  const c = await db();
  const found = new Set<string>();
  const add = (list: Row[], key: string) => list.forEach((r) => r[key] && found.add(str(r[key])));
  const jobs: Promise<void>[] = [];
  if (query.ids) {
    const { from, to } = query.ids;
    jobs.push(
      (async () => {
        const res = await c
          .from("sales_order")
          .select("id")
          .gte("id", from)
          .lte("id", to)
          .limit(limit);
        add(rows(res, "sales"), "id");
      })(),
    );
  }
  if (query.number != null) {
    const n = query.number;
    jobs.push(
      (async () => {
        // A journal of the sale, or of a refund or a void of it (a refund from
        // before 0037 names its adjustment).
        const refs = rows(
          await c
            .from("journal_entry")
            .select("reference_type,reference_id")
            .eq("journal_no", n)
            .in("reference_type", ["sales_order", "sale_refund", "sale_void", "sale_adjustment"]),
          "journals",
        )
          .map((r) => strOrNull(r.reference_id))
          .filter((x): x is string => x !== null);
        const [sales, refunds, adjustments, byNo] = await Promise.all([
          refs.length ? c.from("sales_order").select("id").in("id", refs) : null,
          refs.length ? c.from("sale_refund").select("sales_order_id").in("id", refs) : null,
          refs.length ? c.from("sale_adjustment").select("sales_order_id").in("id", refs) : null,
          c.from("sale_refund").select("sales_order_id").eq("refund_no", n).limit(limit),
        ]);
        if (sales) add(rows(sales, "sales"), "id");
        if (refunds) add(rows(refunds, "refunds"), "sales_order_id");
        if (adjustments) add(rows(adjustments, "voids and refunds"), "sales_order_id");
        add(rows(byNo, "refunds"), "sales_order_id");
      })(),
    );
  }
  if (query.platformOrder) {
    const order = query.platformOrder;
    jobs.push(
      (async () => {
        const res = await c
          .from("platform_order")
          .select("sales_order_id")
          .ilike("external_order_id", likeText(order))
          .limit(limit);
        add(rows(res, "platform orders"), "sales_order_id");
      })(),
    );
  }
  if (query.name || query.phoneTail) {
    const { name, phoneTail } = query;
    jobs.push(
      (async () => {
        const [byName, byPhone] = await Promise.all([
          name
            ? c
                .from("customer")
                .select("id")
                .ilike("full_name", `%${likeText(name)}%`)
                .limit(limit)
            : null,
          phoneTail
            ? c
                .from("customer")
                .select("id")
                .like("phone", `%${likeText(phoneTail)}`)
                .limit(limit)
            : null,
        ]);
        const people = [
          ...(byName ? rows(byName, "customers") : []),
          ...(byPhone ? rows(byPhone, "customers") : []),
        ].map((r) => str(r.id));
        if (!people.length) return;
        const res = await c
          .from("sales_order")
          .select("id")
          .in("customer_id", [...new Set(people)])
          .neq("status", "open")
          .order("placed_at", { ascending: false })
          .limit(limit);
        add(rows(res, "sales"), "id");
      })(),
    );
  }
  await Promise.all(jobs);
  return [...found];
}

/**
 * Recent sales with their lines, tenders and any void or refund (needs
 * cost.view); or those placed between two instants, on one channel.
 */
export async function getSalesOrders(
  limit = 200,
  filter: { fromTs?: string; toTs?: string; channel?: string; ids?: string[] } = {},
): Promise<OrderRow[]> {
  const c = await db();
  let q = c
    .from("sales_order")
    .select("id,channel,status,net_amount,cogs_amount,placed_at,cashier_id")
    .neq("status", "open");
  if (filter.fromTs) q = q.gte("placed_at", filter.fromTs);
  if (filter.toTs) q = q.lt("placed_at", filter.toTs);
  if (filter.channel) q = q.eq("channel", filter.channel);
  if (filter.ids) q = q.in("id", filter.ids);
  const orders = rows(await q.order("placed_at", { ascending: false }).limit(limit), "sales");
  if (orders.length === 0) return [];
  const ids = orders.map((o) => str(o.id));
  const [lines, tenders, adjustments, variants, products, people, refunds] = await Promise.all([
    c
      .from("sales_order_line")
      .select("id,sales_order_id,product_variant_id,product_name,quantity,unit_price,line_net")
      .in("sales_order_id", ids),
    c
      .from("sales_tender")
      .select(
        "sales_order_id,tender_type,amount,received,change_given,position,currency,foreign_amount,rate",
      )
      .in("sales_order_id", ids)
      .order("position"),
    c
      .from("sale_adjustment")
      .select("id,sales_order_id,kind,amount,reason,created_at,requested_by,approved_by")
      .in("sales_order_id", ids),
    c.from("product_variant").select("id,product_id,name"),
    c.from("product").select("id,name"),
    c.from("app_user").select("id,full_name"),
    c
      .from("sale_refund")
      .select(
        "id,refund_no,sales_order_id,amount,cost_returned,reason,created_at,requested_by,approved_by",
      )
      .in("sales_order_id", ids),
  ]);
  const refundRows = rows(refunds, "refunds");
  const refundIds = refundRows.map((r) => str(r.id));
  // Each line's add-ons (0041), named with it: "Latte — Large (+ Oat milk, Extra shot ×2)".
  const addonRows = rows(
    await c
      .from("sales_order_line_modifier")
      .select("sales_order_line_id,name,qty,position")
      .in("sales_order_id", ids)
      .order("position"),
    "add-ons",
  );
  const [refundLines, refundTenders] = refundIds.length
    ? await Promise.all([
        c
          .from("sale_refund_line")
          .select("refund_id,sales_order_line_id,qty,amount")
          .in("refund_id", refundIds),
        c
          .from("sale_refund_tender")
          .select("refund_id,tender_type,amount")
          .in("refund_id", refundIds),
      ])
    : [null, null];
  const productName = new Map(rows(products, "products").map((p) => [str(p.id), str(p.name)]));
  const variantLabel = new Map<string, string>();
  for (const v of rows(variants, "product variants")) {
    const pn = productName.get(str(v.product_id)) ?? "";
    const vn = str(v.name);
    variantLabel.set(str(v.id), pn && pn !== vn ? `${pn} — ${vn}` : vn || pn);
  }
  const person = new Map(rows(people, "people").map((p) => [str(p.id), str(p.full_name)]));
  const group = <T>(list: T[], key: (x: T) => string) => {
    const m = new Map<string, T[]>();
    for (const x of list) m.set(key(x), [...(m.get(key(x)) ?? []), x]);
    return m;
  };
  const saleLines = rows(lines, "sale lines");
  const linesBy = group(saleLines, (l) => str(l.sales_order_id));
  const addonsBy = group(addonRows, (a) => str(a.sales_order_line_id));
  const lineName = new Map(
    saleLines.map((l) => {
      // The name it was sold under (0027); older lines, the product's name now.
      const name = strOrNull(l.product_name) ?? variantLabel.get(str(l.product_variant_id)) ?? "—";
      const each = num(l.quantity);
      const addons = (addonsBy.get(str(l.id)) ?? []).map((a) => {
        const n = each > 0 ? num(a.qty) / each : num(a.qty);
        return n === 1 ? str(a.name) : `${str(a.name)} ×${n}`;
      });
      return [str(l.id), addons.length ? `${name} (+ ${addons.join(", ")})` : name];
    }),
  );
  const tendersBy = group(rows(tenders, "tenders"), (t) => str(t.sales_order_id));
  const adjBy = group(rows(adjustments, "voids and refunds"), (a) => str(a.sales_order_id));
  const rLines = refundLines ? rows(refundLines, "refund lines") : [];
  const rLinesBy = group(rLines, (l) => str(l.refund_id));
  const rLinesByLine = group(rLines, (l) => str(l.sales_order_line_id));
  const rTenders = group(
    (refundTenders ? rows(refundTenders, "refund payments") : []).map((t) => ({
      refundId: str(t.refund_id),
      type: str(t.tender_type) as PayType,
      amount: num(t.amount),
    })),
    (t) => t.refundId,
  );
  const refundsBy = group(refundRows, (r) => str(r.sales_order_id));
  const who = (id: unknown) => (id ? (person.get(str(id)) ?? null) : null);
  return orders.map((o) => {
    const id = str(o.id);
    const adj = adjBy.get(id) ?? [];
    const docs = refundsBy.get(id) ?? [];
    // A refund by the item is shown as a refund; the adjustment it also is, once.
    const docIds = new Set(docs.map((r) => str(r.id)));
    const payments = (tendersBy.get(id) ?? []).map((t) => ({
      type: str(t.tender_type) as PayType,
      amount: num(t.amount),
      received: t.received == null ? null : num(t.received),
      change: t.change_given == null ? null : num(t.change_given),
      // Cash in dollars (0043): how many, at what rate.
      ...(str(t.currency) === "USD"
        ? { currency: "USD" as const, usd: num(t.foreign_amount), rate: num(t.rate) }
        : {}),
    }));
    const refunded = adj
      .filter((a) => str(a.kind) === "refund")
      .reduce((s, a) => s + num(a.amount), 0);
    const named = docs.reduce((s, r) => s + num(r.amount), 0);
    return {
      id,
      channel: str(o.channel),
      status: str(o.status),
      net: num(o.net_amount),
      cogs: num(o.cogs_amount),
      placedAt: str(o.placed_at),
      tenders: [...new Set(payments.map((p) => p.type))],
      payments,
      // A refund from before 0037 names no payment: it gave back the sale's one.
      refundLeft: leftToGiveBack(
        payments,
        docs.flatMap((r) => rTenders.get(str(r.id)) ?? []),
        Math.max(0, refunded - named),
      ),
      cashier: o.cashier_id ? (person.get(str(o.cashier_id)) ?? null) : null,
      lines: (linesBy.get(id) ?? []).map((l) => {
        const back = rLinesByLine.get(str(l.id)) ?? [];
        return {
          id: str(l.id),
          name: lineName.get(str(l.id)) ?? "—",
          qty: num(l.quantity),
          unitPrice: num(l.unit_price),
          lineNet: num(l.line_net),
          refundedQty: back.reduce((s, x) => s + num(x.qty), 0),
          refundedAmount: back.reduce((s, x) => s + num(x.amount), 0),
        };
      }),
      refunded,
      costReturned: docs.reduce((s, r) => s + num(r.cost_returned), 0),
      refunds: docs
        .sort((x, y) => num(x.refund_no) - num(y.refund_no))
        .map((r) => ({
          no: num(r.refund_no),
          amount: num(r.amount),
          at: str(r.created_at),
          reason: strOrNull(r.reason),
          tender: rTenders.get(str(r.id))?.[0]?.type ?? null,
          tenders: (rTenders.get(str(r.id)) ?? []).map(({ type, amount }) => ({ type, amount })),
          by: who(r.requested_by),
          approvedBy: r.approved_by && r.approved_by !== r.requested_by ? who(r.approved_by) : null,
          // By name: the database returns a refund's lines in no set order.
          lines: (rLinesBy.get(str(r.id)) ?? [])
            .map((x) => ({
              name: lineName.get(str(x.sales_order_line_id)) ?? "—",
              qty: num(x.qty),
              amount: num(x.amount),
            }))
            .sort((x, y) => x.name.localeCompare(y.name) || x.qty - y.qty),
        })),
      adjustments: adj
        .filter((a) => !docIds.has(str(a.id)))
        .map((a) => ({
          kind: str(a.kind),
          amount: num(a.amount),
          reason: strOrNull(a.reason),
          at: str(a.created_at),
          by: a.requested_by ? (person.get(str(a.requested_by)) ?? null) : null,
          approvedBy:
            a.approved_by && a.approved_by !== a.requested_by
              ? (person.get(str(a.approved_by)) ?? null)
              : null,
        })),
    };
  });
}

export interface CountSummary {
  id: string;
  status: string;
  countType: string;
  startedAt: string;
  submittedAt: string | null;
  approvedAt: string | null;
  countedBy: string | null;
  countedById: string | null;
  approvedBy: string | null;
  rejectedReason: string | null;
  lines: number;
  counted: number;
  /** Where the count is of (release AB). */
  placeId: string | null;
}

/** Stock counts, newest first. Never includes what the ledger expected. */
export async function getStockCounts(limit = 30): Promise<CountSummary[]> {
  const c = await db();
  const [counts, people] = await Promise.all([
    c
      .from("stock_count")
      .select(
        "id,status,count_type,started_at,submitted_at,approved_at,counted_by,approved_by,rejected_reason,location_id",
      )
      .eq("legacy", false)
      .order("started_at", { ascending: false })
      .limit(limit),
    c.from("app_user").select("id,full_name"),
  ]);
  const list = rows(counts, "stock counts");
  const person = new Map(rows(people, "people").map((p) => [str(p.id), str(p.full_name)]));
  const ids = list.map((x) => str(x.id));
  const lineRows =
    ids.length === 0
      ? []
      : rows(
          await c
            .from("stock_count_line")
            .select("stock_count_id,counted_base")
            .in("stock_count_id", ids),
          "count lines",
        );
  const tally = new Map<string, { lines: number; counted: number }>();
  for (const l of lineRows) {
    const k = str(l.stock_count_id);
    const cur = tally.get(k) ?? { lines: 0, counted: 0 };
    tally.set(k, {
      lines: cur.lines + 1,
      counted: cur.counted + (l.counted_base === null ? 0 : 1),
    });
  }
  return list.map((x) => {
    const id = str(x.id);
    const t = tally.get(id) ?? { lines: 0, counted: 0 };
    return {
      id,
      status: str(x.status),
      countType: str(x.count_type),
      startedAt: str(x.started_at),
      submittedAt: strOrNull(x.submitted_at),
      approvedAt: strOrNull(x.approved_at),
      countedBy: x.counted_by ? (person.get(str(x.counted_by)) ?? null) : null,
      countedById: strOrNull(x.counted_by),
      approvedBy: x.approved_by ? (person.get(str(x.approved_by)) ?? null) : null,
      rejectedReason: strOrNull(x.rejected_reason),
      lines: t.lines,
      counted: t.counted,
      placeId: strOrNull(x.location_id),
    };
  });
}

export interface CountSheetLine {
  itemId: string;
  name: string;
  unit: string;
  counted: number | null;
}

/** The sheet a counter fills in: items and what they have entered so far. */
export async function getCountSheet(countId: string): Promise<CountSheetLine[]> {
  const c = await db();
  const [lines, items] = await Promise.all([
    c.from("stock_count_line").select("item_id,counted_base").eq("stock_count_id", countId),
    c.from("item").select("id,name,base_unit_code"),
  ]);
  const item = new Map(
    rows(items, "items").map((i) => [
      str(i.id),
      { name: str(i.name), unit: str(i.base_unit_code) },
    ]),
  );
  return rows(lines, "the count sheet")
    .map((l) => ({
      itemId: str(l.item_id),
      name: item.get(str(l.item_id))?.name ?? "—",
      unit: item.get(str(l.item_id))?.unit ?? "",
      counted: numOrNull(l.counted_base),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
