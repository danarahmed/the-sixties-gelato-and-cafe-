import "server-only";
/**
 * Every figure on a statement comes from the general ledger — published
 * journal lines only, for exactly the dates asked, in the business's timezone
 * (audit C-03, M-01, M-02, H-09). These call the reporting functions of
 * migration 0017, which check the person's permission themselves.
 */
import { db, num, numOrNull, rows, str, strOrNull, one } from "./client";

export interface TrialBalanceRow {
  code: string;
  name: string;
  type: string;
  opening: number;
  debit: number;
  credit: number;
  closing: number;
}

export async function getTrialBalance(from: string, to: string): Promise<TrialBalanceRow[]> {
  const c = await db();
  return rows(
    await c.rpc("report_trial_balance", { p_from: from, p_to: to }),
    "the trial balance",
  ).map((r: Record<string, unknown>) => ({
    code: str(r.code),
    name: str(r.name),
    type: str(r.account_type),
    opening: num(r.opening),
    debit: num(r.debit),
    credit: num(r.credit),
    closing: num(r.closing),
  }));
}

export interface PnlRow {
  code: string;
  name: string;
  section: "revenue" | "cost_of_sales" | "operating_expenses";
  amount: number;
}

export async function getProfitAndLoss(from: string, to: string): Promise<PnlRow[]> {
  const c = await db();
  return rows(
    await c.rpc("report_profit_and_loss", { p_from: from, p_to: to }),
    "the profit and loss",
  ).map((r: Record<string, unknown>) => ({
    code: str(r.code),
    name: str(r.name),
    section: str(r.section) as PnlRow["section"],
    amount: num(r.amount),
  }));
}

export function pnlTotals(rowsIn: PnlRow[]) {
  const sum = (s: PnlRow["section"]) =>
    rowsIn.filter((r) => r.section === s).reduce((t, r) => t + r.amount, 0);
  const revenue = sum("revenue");
  const costOfSales = sum("cost_of_sales");
  const operating = sum("operating_expenses");
  return {
    revenue,
    costOfSales,
    grossProfit: revenue - costOfSales,
    operating,
    net: revenue - costOfSales - operating,
  };
}

export interface ReconciliationRow {
  key: string;
  label: string;
  subledger: number;
  ledger: number;
  difference: number;
}

/** Each subledger against its control account. Anything but zero needs looking into. */
export async function getReconciliation(asOf: string): Promise<ReconciliationRow[]> {
  const c = await db();
  return rows(await c.rpc("report_reconciliation", { p_as_of: asOf }), "the reconciliation").map(
    (r: Record<string, unknown>) => ({
      key: str(r.check_key),
      label: str(r.label),
      subledger: num(r.subledger),
      ledger: num(r.ledger),
      difference: num(r.difference),
    }),
  );
}

export interface UnpostedRecord {
  kind: string;
  refId: string;
  at: string;
  description: string;
  amount: number;
  /** The journal it would post, as "1200 Dr 20,000 · 3000 Cr 20,000". */
  entry: string;
}

/**
 * Stock records the old app moved but never journaled, each with the journal
 * the new app writes for the same record. They show as an Inventory
 * difference until the owner reviews and posts them (docs/REMEDIATION.md).
 */
export async function getLegacyUnposted(): Promise<UnpostedRecord[]> {
  const c = await db();
  return rows(await c.rpc("legacy_unposted"), "the records awaiting their journals").map((r) => {
    const lines = Array.isArray(r.lines) ? (r.lines as Record<string, unknown>[]) : [];
    return {
      kind: str(r.kind),
      refId: str(r.ref_id),
      at: str(r.at),
      description: str(r.description),
      amount: num(r.amount),
      entry: lines
        .map((l) =>
          num(l.debit) > 0
            ? `${str(l.code)} Dr ${num(l.debit).toLocaleString("en-US")}`
            : `${str(l.code)} Cr ${num(l.credit).toLocaleString("en-US")}`,
        )
        .join(" · "),
    };
  });
}

export interface Dashboard {
  netRevenue: number;
  costOfSales: number;
  grossProfit: number;
  orders: number;
  averageOrder: number;
  inventoryValue: number;
  lowStock: number;
  negativeStock: number;
}

export async function getDashboard(day: string): Promise<Dashboard> {
  const c = await db();
  const d = (one(await c.rpc("dashboard_summary", { p_day: day }), "today's figures") ??
    {}) as Record<string, unknown>;
  return {
    netRevenue: num(d.net_revenue),
    costOfSales: num(d.cost_of_sales),
    grossProfit: num(d.gross_profit),
    orders: num(d.orders),
    averageOrder: num(d.average_order),
    inventoryValue: num(d.inventory_value),
    lowStock: num(d.low_stock),
    negativeStock: num(d.negative_stock),
  };
}

export interface MenuCostRow {
  variantId: string;
  productId: string;
  productName: string;
  variantName: string;
  category: string | null;
  channel: string;
  price: number;
  /** What one serving costs today, costed as a sale would post it; null if it cannot be costed. */
  unitCost: number | null;
}

export async function getMenuCosting(): Promise<MenuCostRow[]> {
  const c = await db();
  return rows(await c.rpc("menu_costing"), "menu costs").map((r: Record<string, unknown>) => ({
    variantId: str(r.variant_id),
    productId: str(r.product_id),
    productName: str(r.product_name),
    variantName: str(r.variant_name),
    category: strOrNull(r.category),
    channel: str(r.channel),
    price: num(r.price),
    unitCost: numOrNull(r.unit_cost),
  }));
}

/** What one base unit of each stock item costs today, exact, by item id (for pricing a recipe). */
export async function getItemCosts(): Promise<Map<string, string>> {
  const c = await db();
  return new Map(
    rows(await c.rpc("item_costs"), "stock costs").map(
      (r: Record<string, unknown>) => [str(r.item_id), str(r.unit_cost)] as const,
    ),
  );
}

export interface RecipeLineRow {
  variantId: string;
  versionNo: number;
  effectiveFrom: string;
  component: string;
  quantity: number;
  unitCode: string;
  channels: string[] | null;
  /** The line's item; null for a sub-recipe line. */
  itemId: string | null;
}

export async function getMenuRecipeLines(): Promise<RecipeLineRow[]> {
  const c = await db();
  return rows(await c.rpc("menu_recipe_lines"), "recipes").map((r: Record<string, unknown>) => ({
    variantId: str(r.variant_id),
    versionNo: num(r.version_no),
    effectiveFrom: str(r.effective_from),
    component: str(r.component),
    quantity: num(r.quantity),
    unitCode: str(r.unit_code),
    channels: Array.isArray(r.channels) && r.channels.length > 0 ? r.channels.map(String) : null,
    itemId: strOrNull(r.item_id),
  }));
}

/** A price or a product recipe set to start on a later date (0025). */
export interface ScheduledChange {
  kind: "price" | "recipe";
  id: string;
  variantId: string;
  channel: string | null;
  price: number | null;
  effectiveFrom: string;
  versionNo: number | null;
}

export async function getMenuScheduled(): Promise<ScheduledChange[]> {
  const c = await db();
  return rows(await c.rpc("menu_scheduled"), "scheduled changes").map(
    (r: Record<string, unknown>) => ({
      kind: str(r.kind) === "recipe" ? "recipe" : "price",
      id: str(r.id),
      variantId: str(r.variant_id),
      channel: strOrNull(r.channel),
      price: numOrNull(r.price),
      effectiveFrom: str(r.effective_from),
      versionNo: r.version_no == null ? null : num(r.version_no),
    }),
  );
}

/** A sale whose cost is understated (0025): costed at nothing, or partly at nothing. */
export interface UncostedSale {
  orderId: string;
  placedAt: string;
  channel: string;
  products: string;
  net: number;
  cogs: number;
  reasons: string;
}

export async function getUncostedSales(from: string, to: string): Promise<UncostedSale[]> {
  const c = await db();
  return rows(
    await c.rpc("report_uncosted_sales", { p_from: from, p_to: to }),
    "uncosted sales",
  ).map((r: Record<string, unknown>) => ({
    orderId: str(r.order_id),
    placedAt: str(r.placed_at),
    channel: str(r.channel),
    products: str(r.products),
    net: num(r.net),
    cogs: num(r.cogs),
    reasons: str(r.reasons),
  }));
}

export interface MemberRow {
  id: string;
  name: string;
  email: string;
  roles: string[];
  isActive: boolean;
  linked: boolean;
}

export async function getMembers(): Promise<MemberRow[]> {
  const c = await db();
  return rows(await c.rpc("list_members"), "the people").map((r: Record<string, unknown>) => ({
    id: str(r.id),
    name: str(r.full_name),
    email: str(r.email),
    roles: Array.isArray(r.roles) ? r.roles.map(String) : [],
    isActive: Boolean(r.is_active),
    linked: Boolean(r.linked),
  }));
}
