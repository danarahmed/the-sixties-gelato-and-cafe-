/**
 * Live database reads for the screens that show records (dashboard, orders,
 * ledger, purchasing, accounting, platforms, AI, settings). Every function
 * returns null when the DB is not configured, and plain serialisable data
 * otherwise. All rows are scoped to the demo business by RLS.
 */
import { getSupabase, DEMO_BUSINESS_ID } from "@/lib/supabase/client";

const biz = DEMO_BUSINESS_ID;

export interface BusinessConfig {
  id: string;
  name: string;
  currencyCode: string;
  currencyDecimals: number;
  timezone: string;
  defaultLocale: string;
  preventNegativeStock: boolean;
}

export async function getBusinessConfig(): Promise<BusinessConfig | null> {
  const db = getSupabase();
  if (!db) return null;
  const { data, error } = await db
    .from("business")
    .select("id,name,currency_code,currency_decimals,timezone,default_locale,prevent_negative_stock")
    .eq("id", biz)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    id: String(data.id),
    name: String(data.name),
    currencyCode: String(data.currency_code),
    currencyDecimals: Number(data.currency_decimals),
    timezone: String(data.timezone),
    defaultLocale: String(data.default_locale),
    preventNegativeStock: Boolean(data.prevent_negative_stock),
  };
}

export interface LocationRow {
  id: string;
  name: string;
  kind: string;
  isActive: boolean;
}

export async function getLocations(): Promise<LocationRow[]> {
  const db = getSupabase();
  if (!db) return [];
  const { data, error } = await db
    .from("location")
    .select("id,name,kind,is_active")
    .eq("business_id", biz)
    .order("created_at");
  if (error) throw new Error(error.message);
  return (data ?? []).map((l) => ({
    id: String(l.id),
    name: String(l.name),
    kind: String(l.kind),
    isActive: Boolean(l.is_active),
  }));
}

/** The default branch location id (first branch, else first location). */
export async function getDefaultLocationId(): Promise<string | null> {
  const locs = await getLocations();
  const chosen = locs.find((l) => l.kind === "branch") ?? locs[0];
  return chosen ? chosen.id : null;
}

export interface ItemRow {
  id: string;
  name: string;
  itemType: string;
  baseUnit: string;
  dimension: string;
  minLevelBase: number | null;
}

export async function getItems(): Promise<ItemRow[]> {
  const db = getSupabase();
  if (!db) return [];
  const { data, error } = await db
    .from("item")
    .select("id,name,item_type,base_unit_code,dimension,min_level_base,is_active")
    .eq("business_id", biz)
    .eq("is_active", true)
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []).map((i) => ({
    id: String(i.id),
    name: String(i.name),
    itemType: String(i.item_type),
    baseUnit: String(i.base_unit_code),
    dimension: String(i.dimension),
    minLevelBase: i.min_level_base === null ? null : Number(i.min_level_base),
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
}

export async function getMovements(limit = 100): Promise<MovementRow[]> {
  const db = getSupabase();
  if (!db) return [];
  const [movR, itemsR] = await Promise.all([
    db
      .from("inventory_movement")
      .select("id,item_id,type,base_quantity_signed,unit_cost,value,reason,occurred_at")
      .eq("business_id", biz)
      .order("occurred_at", { ascending: false })
      .limit(limit),
    db.from("item").select("id,name").eq("business_id", biz),
  ]);
  if (movR.error) throw new Error(movR.error.message);
  const names = new Map<string, string>();
  for (const i of itemsR.data ?? []) names.set(String(i.id), String(i.name));
  return (movR.data ?? []).map((m) => ({
    id: String(m.id),
    itemName: names.get(String(m.item_id)) ?? "—",
    type: String(m.type),
    qty: Number(m.base_quantity_signed),
    unitCost: m.unit_cost === null ? null : Number(m.unit_cost),
    value: m.value === null ? null : Number(m.value),
    reason: m.reason ? String(m.reason) : null,
    occurredAt: String(m.occurred_at),
  }));
}

export interface OrderRow {
  id: string;
  channel: string;
  status: string;
  net: number;
  gross: number;
  cogs: number;
  placedAt: string;
  tenders: string[];
  lines: { name: string; qty: number; unitPrice: number; lineNet: number; cogs: number }[];
}

export async function getSalesOrders(limit = 200): Promise<OrderRow[]> {
  const db = getSupabase();
  if (!db) return [];
  const ordR = await db
    .from("sales_order")
    .select("id,channel,status,net_amount,gross_amount,cogs_amount,placed_at")
    .eq("business_id", biz)
    .order("placed_at", { ascending: false })
    .limit(limit);
  if (ordR.error) throw new Error(ordR.error.message);
  const orders = ordR.data ?? [];
  if (orders.length === 0) return [];
  const ids = orders.map((o) => String(o.id));
  const [linesR, tendersR, variantsR, productsR] = await Promise.all([
    db.from("sales_order_line").select("sales_order_id,product_variant_id,quantity,unit_price,line_net,cogs_amount").in("sales_order_id", ids),
    db.from("sales_tender").select("sales_order_id,tender_type,amount").in("sales_order_id", ids),
    db.from("product_variant").select("id,product_id,name"),
    db.from("product").select("id,name").eq("business_id", biz),
  ]);
  const prodName = new Map<string, string>();
  for (const p of productsR.data ?? []) prodName.set(String(p.id), String(p.name));
  const variantLabel = new Map<string, string>();
  for (const v of variantsR.data ?? []) {
    const pn = prodName.get(String(v.product_id)) ?? "";
    const vn = String(v.name);
    variantLabel.set(String(v.id), pn && pn !== vn ? `${pn} — ${vn}` : vn || pn);
  }
  const linesByOrder = new Map<string, OrderRow["lines"]>();
  for (const l of linesR.data ?? []) {
    const arr = linesByOrder.get(String(l.sales_order_id)) ?? [];
    arr.push({
      name: variantLabel.get(String(l.product_variant_id)) ?? "—",
      qty: Number(l.quantity),
      unitPrice: Number(l.unit_price),
      lineNet: Number(l.line_net),
      cogs: l.cogs_amount === null ? 0 : Number(l.cogs_amount),
    });
    linesByOrder.set(String(l.sales_order_id), arr);
  }
  const tendersByOrder = new Map<string, string[]>();
  for (const t of tendersR.data ?? []) {
    const arr = tendersByOrder.get(String(t.sales_order_id)) ?? [];
    arr.push(String(t.tender_type));
    tendersByOrder.set(String(t.sales_order_id), arr);
  }
  return orders.map((o) => ({
    id: String(o.id),
    channel: String(o.channel),
    status: String(o.status),
    net: Number(o.net_amount),
    gross: Number(o.gross_amount),
    cogs: o.cogs_amount === null ? 0 : Number(o.cogs_amount),
    placedAt: String(o.placed_at),
    tenders: tendersByOrder.get(String(o.id)) ?? [],
    lines: linesByOrder.get(String(o.id)) ?? [],
  }));
}

export interface SupplierRow {
  id: string;
  name: string;
  contact: string | null;
  phone: string | null;
}

export async function getSuppliers(): Promise<SupplierRow[]> {
  const db = getSupabase();
  if (!db) return [];
  const { data, error } = await db
    .from("supplier")
    .select("id,name,contact,phone,is_active")
    .eq("business_id", biz)
    .eq("is_active", true)
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []).map((s) => ({
    id: String(s.id),
    name: String(s.name),
    contact: s.contact ? String(s.contact) : null,
    phone: s.phone ? String(s.phone) : null,
  }));
}

export interface ReceiptRow {
  id: string;
  receivedAt: string;
  supplierName: string | null;
  goodsValue: number;
  landed: number;
  lineCount: number;
}

export async function getReceipts(limit = 50): Promise<ReceiptRow[]> {
  const db = getSupabase();
  if (!db) return [];
  const grR = await db
    .from("goods_receipt")
    .select("id,received_at,purchase_order_id,freight_total,other_landed_total,rebate_total,note")
    .eq("business_id", biz)
    .order("received_at", { ascending: false })
    .limit(limit);
  if (grR.error) throw new Error(grR.error.message);
  const receipts = grR.data ?? [];
  if (receipts.length === 0) return [];
  const ids = receipts.map((r) => String(r.id));
  const linesR = await db
    .from("goods_receipt_line")
    .select("goods_receipt_id,goods_value")
    .in("goods_receipt_id", ids);
  const agg = new Map<string, { value: number; count: number }>();
  for (const l of linesR.data ?? []) {
    const cur = agg.get(String(l.goods_receipt_id)) ?? { value: 0, count: 0 };
    cur.value += Number(l.goods_value);
    cur.count += 1;
    agg.set(String(l.goods_receipt_id), cur);
  }
  return receipts.map((r) => {
    const a = agg.get(String(r.id)) ?? { value: 0, count: 0 };
    return {
      id: String(r.id),
      receivedAt: String(r.received_at),
      supplierName: r.note ? String(r.note) : null,
      goodsValue: a.value,
      landed: Number(r.freight_total) + Number(r.other_landed_total) - Number(r.rebate_total),
      lineCount: a.count,
    };
  });
}

export interface AccountRow {
  id: string;
  code: string;
  name: string;
  type: string;
  normalBalance: string;
}

export async function getGlAccounts(): Promise<AccountRow[]> {
  const db = getSupabase();
  if (!db) return [];
  const { data, error } = await db
    .from("gl_account")
    .select("id,code,name,account_type,normal_balance,is_active")
    .eq("business_id", biz)
    .order("code");
  if (error) throw new Error(error.message);
  return (data ?? []).map((a) => ({
    id: String(a.id),
    code: String(a.code),
    name: String(a.name),
    type: String(a.account_type),
    normalBalance: String(a.normal_balance),
  }));
}

export interface JournalRow {
  id: string;
  description: string;
  occurredAt: string;
  lines: { account: string; debit: number; credit: number }[];
}

export async function getJournalEntries(limit = 50): Promise<JournalRow[]> {
  const db = getSupabase();
  if (!db) return [];
  const jeR = await db
    .from("journal_entry")
    .select("id,description,occurred_at")
    .eq("business_id", biz)
    .order("occurred_at", { ascending: false })
    .limit(limit);
  if (jeR.error) throw new Error(jeR.error.message);
  const entries = jeR.data ?? [];
  if (entries.length === 0) return [];
  const ids = entries.map((e) => String(e.id));
  const [linesR, accR] = await Promise.all([
    db.from("journal_line").select("journal_entry_id,account_id,debit,credit").in("journal_entry_id", ids),
    db.from("gl_account").select("id,code,name").eq("business_id", biz),
  ]);
  const accLabel = new Map<string, string>();
  for (const a of accR.data ?? []) accLabel.set(String(a.id), `${a.code} ${a.name}`);
  const linesByEntry = new Map<string, JournalRow["lines"]>();
  for (const l of linesR.data ?? []) {
    const arr = linesByEntry.get(String(l.journal_entry_id)) ?? [];
    arr.push({
      account: accLabel.get(String(l.account_id)) ?? "—",
      debit: Number(l.debit),
      credit: Number(l.credit),
    });
    linesByEntry.set(String(l.journal_entry_id), arr);
  }
  return entries.map((e) => ({
    id: String(e.id),
    description: String(e.description),
    occurredAt: String(e.occurred_at),
    lines: linesByEntry.get(String(e.id)) ?? [],
  }));
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
  const db = getSupabase();
  if (!db) return [];
  const [pbR, recR] = await Promise.all([
    db
      .from("production_batch")
      .select("id,recipe_id,status,batches,actual_yield_base,produced_at,created_at")
      .eq("business_id", biz)
      .order("created_at", { ascending: false })
      .limit(limit),
    db.from("recipe").select("id,name").eq("business_id", biz),
  ]);
  if (pbR.error) throw new Error(pbR.error.message);
  const recName = new Map<string, string>();
  for (const r of recR.data ?? []) recName.set(String(r.id), String(r.name));
  return (pbR.data ?? []).map((b) => ({
    id: String(b.id),
    recipeName: recName.get(String(b.recipe_id)) ?? "—",
    status: String(b.status),
    batches: Number(b.batches),
    actualYield: b.actual_yield_base === null ? null : Number(b.actual_yield_base),
    producedAt: b.produced_at ? String(b.produced_at) : null,
  }));
}

export interface AiInsightRow {
  id: string;
  kind: string;
  title: string;
  recommendation: string;
  explanation: string | null;
  status: string;
  createdAt: string;
}

export async function getAiInsights(): Promise<AiInsightRow[]> {
  const db = getSupabase();
  if (!db) return [];
  const { data, error } = await db
    .from("ai_insight")
    .select("id,kind,title,recommendation,explanation,status,created_at")
    .eq("business_id", biz)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: String(r.id),
    kind: String(r.kind),
    title: String(r.title),
    recommendation: String(r.recommendation),
    explanation: r.explanation ? String(r.explanation) : null,
    status: String(r.status),
    createdAt: String(r.created_at),
  }));
}
