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
import { db, num, numOrNull, rows, str, strOrNull, one } from "./client";

export interface BusinessConfig {
  id: string;
  name: string;
  currencyCode: string;
  currencyDecimals: number;
  timezone: string;
  defaultLocale: string;
  preventNegativeStock: boolean;
  wasteApprovalThreshold: number;
}

export async function getBusinessConfig(): Promise<BusinessConfig | null> {
  const c = await db();
  const b = one(
    await c
      .from("business")
      .select(
        "id,name,currency_code,currency_decimals,timezone,default_locale,prevent_negative_stock,waste_approval_threshold",
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
  itemType: string;
  baseUnit: string;
  dimension: string;
  minLevelBase: number | null;
  /** The base unit first, then any pack sizes (kg, case of 24, …). */
  units: UnitOption[];
}

export async function getItems(): Promise<ItemRow[]> {
  const c = await db();
  const [items, units] = await Promise.all([
    c
      .from("item")
      .select("id,name,item_type,base_unit_code,dimension,min_level_base")
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
      itemType: str(i.item_type),
      baseUnit: base,
      dimension: str(i.dimension),
      minLevelBase: numOrNull(i.min_level_base),
      units: [{ code: base, label: base, factor: 1 }, ...extra],
    };
  });
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

/** Stock on hand, derived from the movement ledger (needs cost.view). */
export async function getStockBoard(): Promise<StockRow[]> {
  const c = await db();
  return rows(
    await c
      .from("stock_board")
      .select(
        "item_id,name,item_type,base_unit_code,quantity_base,value,unit_cost,min_level_base,is_low,is_negative",
      )
      .order("name"),
    "stock on hand",
  ).map((r) => ({
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

export async function getMovements(limit = 100): Promise<MovementRow[]> {
  const c = await db();
  const [moves, items, people] = await Promise.all([
    c
      .from("inventory_movement")
      .select("id,item_id,type,base_quantity_signed,unit_cost,value,reason,occurred_at,app_user_id")
      .order("occurred_at", { ascending: false })
      .limit(limit),
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
  /** Received through the controlled path (posted to GRNI), so it can be billed against. */
  billable: boolean;
}

export async function getReceipts(limit = 50): Promise<ReceiptRow[]> {
  const c = await db();
  const receipts = rows(
    await c
      .from("goods_receipt")
      .select("id,receipt_no,received_at,supplier_id,freight_total,other_landed_total,rebate_total")
      .order("received_at", { ascending: false })
      .limit(limit),
    "goods receipts",
  );
  if (receipts.length === 0) return [];
  const ids = receipts.map((r) => str(r.id));
  const [lines, moves, bills, journals, suppliers] = await Promise.all([
    c.from("goods_receipt_line").select("goods_receipt_id,goods_value").in("goods_receipt_id", ids),
    c
      .from("inventory_movement")
      .select("reference_id,value")
      .eq("reference_type", "goods_receipt")
      .eq("type", "purchase_receipt")
      .in("reference_id", ids),
    c.from("purchase_invoice").select("goods_receipt_id").in("goods_receipt_id", ids),
    c
      .from("journal_entry")
      .select("reference_id")
      .eq("reference_type", "goods_receipt")
      .eq("status", "published")
      .eq("legacy", false)
      .in("reference_id", ids),
    c.from("supplier").select("id,name"),
  ]);
  const goods = new Map<string, { value: number; count: number }>();
  for (const l of rows(lines, "receipt lines")) {
    const k = str(l.goods_receipt_id);
    const cur = goods.get(k) ?? { value: 0, count: 0 };
    goods.set(k, { value: cur.value + num(l.goods_value), count: cur.count + 1 });
  }
  const valued = new Map<string, number>();
  for (const m of rows(moves, "receipt movements")) {
    valued.set(str(m.reference_id), (valued.get(str(m.reference_id)) ?? 0) + num(m.value));
  }
  const billed = new Set(rows(bills, "bills").map((b) => str(b.goods_receipt_id)));
  const controlled = new Set(rows(journals, "receipt journals").map((j) => str(j.reference_id)));
  const supplierName = new Map(rows(suppliers, "suppliers").map((s) => [str(s.id), str(s.name)]));
  return receipts.map((r) => {
    const id = str(r.id);
    const g = goods.get(id) ?? { value: 0, count: 0 };
    return {
      id,
      receiptNo: numOrNull(r.receipt_no),
      receivedAt: str(r.received_at),
      supplierId: strOrNull(r.supplier_id),
      supplierName: r.supplier_id ? (supplierName.get(str(r.supplier_id)) ?? null) : null,
      goodsValue: g.value,
      landedExtras: num(r.freight_total) + num(r.other_landed_total) - num(r.rebate_total),
      value: valued.get(id) ?? 0,
      lineCount: g.count,
      billed: billed.has(id),
      billable: controlled.has(id) && !billed.has(id),
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
  tenders: string[];
  cashier: string | null;
  lines: { name: string; qty: number; unitPrice: number; lineNet: number }[];
  adjustments: { kind: string; amount: number; reason: string | null; at: string }[];
}

/** Recent sales with their lines, tenders and any void or refund (needs cost.view). */
export async function getSalesOrders(limit = 200): Promise<OrderRow[]> {
  const c = await db();
  const orders = rows(
    await c
      .from("sales_order")
      .select("id,channel,status,net_amount,cogs_amount,placed_at,cashier_id")
      .neq("status", "open")
      .order("placed_at", { ascending: false })
      .limit(limit),
    "sales",
  );
  if (orders.length === 0) return [];
  const ids = orders.map((o) => str(o.id));
  const [lines, tenders, adjustments, variants, products, people] = await Promise.all([
    c
      .from("sales_order_line")
      .select("sales_order_id,product_variant_id,quantity,unit_price,line_net")
      .in("sales_order_id", ids),
    c.from("sales_tender").select("sales_order_id,tender_type").in("sales_order_id", ids),
    c
      .from("sale_adjustment")
      .select("sales_order_id,kind,amount,reason,created_at")
      .in("sales_order_id", ids),
    c.from("product_variant").select("id,product_id,name"),
    c.from("product").select("id,name"),
    c.from("app_user").select("id,full_name"),
  ]);
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
  const linesBy = group(rows(lines, "sale lines"), (l) => str(l.sales_order_id));
  const tendersBy = group(rows(tenders, "tenders"), (t) => str(t.sales_order_id));
  const adjBy = group(rows(adjustments, "voids and refunds"), (a) => str(a.sales_order_id));
  return orders.map((o) => {
    const id = str(o.id);
    return {
      id,
      channel: str(o.channel),
      status: str(o.status),
      net: num(o.net_amount),
      cogs: num(o.cogs_amount),
      placedAt: str(o.placed_at),
      tenders: (tendersBy.get(id) ?? []).map((t) => str(t.tender_type)),
      cashier: o.cashier_id ? (person.get(str(o.cashier_id)) ?? null) : null,
      lines: (linesBy.get(id) ?? []).map((l) => ({
        name: variantLabel.get(str(l.product_variant_id)) ?? "—",
        qty: num(l.quantity),
        unitPrice: num(l.unit_price),
        lineNet: num(l.line_net),
      })),
      adjustments: (adjBy.get(id) ?? []).map((a) => ({
        kind: str(a.kind),
        amount: num(a.amount),
        reason: strOrNull(a.reason),
        at: str(a.created_at),
      })),
    };
  });
}

export interface ProductionBatchRow {
  id: string;
  recipeName: string;
  status: string;
  batches: number;
  actualYield: number | null;
  producedAt: string | null;
}

export async function getProductionBatches(limit = 50): Promise<ProductionBatchRow[]> {
  const c = await db();
  const [batches, recipes] = await Promise.all([
    c
      .from("production_batch")
      .select("id,recipe_id,status,batches,actual_yield_base,produced_at,created_at")
      .order("created_at", { ascending: false })
      .limit(limit),
    c.from("recipe").select("id,name"),
  ]);
  const recipeName = new Map(rows(recipes, "recipes").map((r) => [str(r.id), str(r.name)]));
  return rows(batches, "production batches").map((b) => ({
    id: str(b.id),
    recipeName: recipeName.get(str(b.recipe_id)) ?? "—",
    status: str(b.status),
    batches: num(b.batches),
    actualYield: numOrNull(b.actual_yield_base),
    producedAt: strOrNull(b.produced_at),
  }));
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
}

/** Stock counts, newest first. Never includes what the ledger expected. */
export async function getStockCounts(limit = 30): Promise<CountSummary[]> {
  const c = await db();
  const [counts, people] = await Promise.all([
    c
      .from("stock_count")
      .select(
        "id,status,count_type,started_at,submitted_at,approved_at,counted_by,approved_by,rejected_reason",
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
