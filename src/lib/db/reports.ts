import "server-only";
/**
 * Every figure on a statement comes from the general ledger — published
 * journal lines only, for exactly the dates asked, in the business's timezone
 * (audit C-03, M-01, M-02, H-09). These call the reporting functions of
 * migration 0017, which check the person's permission themselves.
 */
import { db, num, numOrNull, rows, str, strOrNull, one } from "./client";
import type { ExceptionKind, ExceptionRow } from "@/lib/exceptions";
import { lossReportFrom, type LossReport } from "@/lib/losses";

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

export interface DocumentProblem {
  /** sale, void, refund, delivery, correction, bill, payment, expense, stock, count, cash, session, card, platform, journal */
  kind: string;
  recordId: string;
  at: string;
  problem: string;
}

/**
 * The records the reconciliation's last check counts (0038): each without its
 * one journal, or an automatic journal without its record, as at the end of a day.
 */
export async function getDocumentProblems(asOf: string): Promise<DocumentProblem[]> {
  const c = await db();
  return rows(
    await c.rpc("report_document_problems", { p_as_of: asOf }),
    "the records to look into",
  ).map((r: Record<string, unknown>) => ({
    kind: str(r.kind),
    recordId: str(r.record_id),
    at: str(r.at),
    problem: str(r.problem),
  }));
}

export interface UsageRow {
  itemId: string;
  name: string;
  unit: string;
  /** How many approved counts of it fall in the dates: usage needs two. */
  counts: number;
  openedAt: string | null;
  closedAt: string | null;
  opening: number | null;
  closing: number | null;
  received: number;
  made: number;
  transferred: number;
  openingStock: number;
  corrected: number;
  sold: number;
  batches: number;
  theoretical: number;
  lost: number;
  losses: { kind: string; qty: number }[];
  actual: number;
  variance: number;
  variancePercent: number | null;
  unitCost: number | null;
  varianceValue: number;
  products: { name: string; sold: number; used: number }[];
  recipes: { name: string; batches: number; used: number }[];
  factors: string[];
}

/**
 * Usage against the recipes (0039): each item between its first and last
 * approved count in the dates, at the location.
 */
export async function getUsageVariance(from: string, to: string): Promise<UsageRow[]> {
  const c = await db();
  const list = (v: unknown) => (Array.isArray(v) ? (v as Record<string, unknown>[]) : []);
  return rows(
    await c.rpc("report_usage_variance", { p_from: from, p_to: to }),
    "usage against the recipes",
  ).map((r: Record<string, unknown>) => ({
    itemId: str(r.item_id),
    name: str(r.name),
    unit: str(r.unit),
    counts: num(r.counts),
    openedAt: strOrNull(r.opened_at),
    closedAt: strOrNull(r.closed_at),
    opening: numOrNull(r.opening),
    closing: numOrNull(r.closing),
    received: num(r.received),
    made: num(r.made),
    transferred: num(r.transferred),
    openingStock: num(r.opening_stock),
    corrected: num(r.corrected),
    sold: num(r.sold),
    batches: num(r.batches),
    theoretical: num(r.theoretical),
    lost: num(r.lost),
    losses: Object.entries((r.losses ?? {}) as Record<string, unknown>).map(([kind, qty]) => ({
      kind,
      qty: num(qty),
    })),
    actual: num(r.actual),
    variance: num(r.variance),
    variancePercent: numOrNull(r.variance_percent),
    unitCost: numOrNull(r.unit_cost),
    varianceValue: num(r.variance_value),
    products: list(r.products).map((p) => ({
      name: str(p.name),
      sold: num(p.sold),
      used: num(p.used),
    })),
    recipes: list(r.recipes).map((p) => ({
      name: str(p.name),
      batches: num(p.batches),
      used: num(p.used),
    })),
    factors: Array.isArray(r.factors) ? (r.factors as unknown[]).map(String) : [],
  }));
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

/** One journal line, as the ledger has it (0026). */
export interface JournalLineRow {
  entryId: string;
  journalNo: number | null;
  occurredAt: string;
  day: string;
  description: string;
  referenceType: string | null;
  referenceNo: string | null;
  accountCode: string;
  accountName: string;
  memo: string | null;
  debit: number;
  credit: number;
  postedBy: string | null;
  reversesJournalNo: number | null;
}

/** A page of lines: the hosted API returns at most 1,000 rows a call. */
const LINES_PAGE = 1000;

/**
 * The published journal lines in the dates, of some accounts or all of them,
 * in the ledger's order; the P&L's leave out the year-end close. Read a page
 * at a time, up to `max` lines.
 */
export async function getJournalLines(
  from: string,
  to: string,
  opts: { accounts?: string[] | null; excludeYearEnd?: boolean; max?: number } = {},
): Promise<{ lines: JournalLineRow[]; more: boolean }> {
  const c = await db();
  const max = opts.max ?? 100_000;
  const lines: JournalLineRow[] = [];
  for (let start = 0; start < max; start += LINES_PAGE) {
    const size = Math.min(LINES_PAGE, max - start);
    const page = rows(
      await c
        .rpc("report_journal_lines", {
          p_from: from,
          p_to: to,
          p_accounts: opts.accounts && opts.accounts.length > 0 ? opts.accounts : null,
          p_exclude_year_end: opts.excludeYearEnd ?? false,
        })
        .range(start, start + size - 1),
      "the journal lines",
    ).map((r: Record<string, unknown>) => ({
      entryId: str(r.journal_entry_id),
      journalNo: numOrNull(r.journal_no),
      occurredAt: str(r.occurred_at),
      day: str(r.day),
      description: str(r.description),
      referenceType: strOrNull(r.reference_type),
      referenceNo: strOrNull(r.reference_no),
      accountCode: str(r.account_code),
      accountName: str(r.account_name),
      memo: strOrNull(r.memo),
      debit: num(r.debit),
      credit: num(r.credit),
      postedBy: strOrNull(r.posted_by),
      reversesJournalNo: numOrNull(r.reverses_journal_no),
    }));
    lines.push(...page);
    if (page.length < size) return { lines, more: false };
  }
  return { lines, more: true };
}

/** One line of an item's stock card (0026); the first (seq 0) is what it opened with. */
export interface StockCardRow {
  seq: number;
  occurredAt: string;
  day: string;
  kind: StockCardKind;
  movement: string | null;
  qty: number;
  value: number;
  balanceQty: number;
  balanceValue: number;
  reason: string | null;
  referenceType: string | null;
  by: string | null;
  location: string | null;
}

export type StockCardKind =
  | "opening"
  | "opening_stock"
  | "received"
  | "sold"
  | "batches"
  | "made"
  | "wasted"
  | "counted"
  | "corrected"
  | "revalued"
  | "transferred";

export async function getStockCard(
  itemId: string,
  from: string,
  to: string,
): Promise<StockCardRow[]> {
  const c = await db();
  const out: StockCardRow[] = [];
  for (let start = 0; ; start += LINES_PAGE) {
    const page = rows(
      await c
        .rpc("stock_card", { p_item: itemId, p_from: from, p_to: to })
        .range(start, start + LINES_PAGE - 1),
      "the stock card",
    ).map((r: Record<string, unknown>) => ({
      seq: num(r.seq),
      occurredAt: str(r.occurred_at),
      day: str(r.day),
      kind: str(r.kind) as StockCardKind,
      movement: strOrNull(r.movement),
      qty: num(r.qty),
      value: num(r.value),
      balanceQty: num(r.balance_qty),
      balanceValue: num(r.balance_value),
      reason: strOrNull(r.reason),
      referenceType: strOrNull(r.reference_type),
      by: strOrNull(r.by_name),
      location: strOrNull(r.location),
    }));
    out.push(...page);
    if (page.length < LINES_PAGE) return out;
  }
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

/**
 * Every exception in the dates, by person (0028, the audit's P1-10), read a
 * page at a time (the hosted API returns at most 1,000 rows a call).
 */
export async function getExceptions(
  from: string,
  to: string,
  max = 20_000,
): Promise<ExceptionRow[]> {
  const c = await db();
  const out: ExceptionRow[] = [];
  for (let start = 0; start < max; start += LINES_PAGE) {
    const size = Math.min(LINES_PAGE, max - start);
    const page = rows(
      await c.rpc("report_exceptions", { p_from: from, p_to: to }).range(start, start + size - 1),
      "the exceptions",
    ).map((r: Record<string, unknown>) => ({
      at: str(r.at),
      kind: str(r.kind) as ExceptionKind,
      personId: strOrNull(r.person_id),
      person: strOrNull(r.person),
      amount: numOrNull(r.amount),
      reason: strOrNull(r.reason),
      approvedBy: strOrNull(r.approved_by),
      needsReview: Boolean(r.needs_review),
      reference: str(r.reference),
      detail: strOrNull(r.detail),
    }));
    out.push(...page);
    if (page.length < size) break;
  }
  return out;
}

/** What each size and each add-on sold, cost and made over some days (0041). */
export interface SizeAddonRow {
  kind: "size" | "addon";
  /** The product, for a size; the group, for an add-on. */
  parent: string;
  name: string;
  /** How many were sold: sizes by the line, add-ons by the one. */
  qty: number;
  /** The lines they were on. */
  lines: number;
  sales: number;
  cost: number;
  margin: number;
  /** For an add-on: the lines of the products that offer it now, to say how often it is taken. */
  offered: number | null;
}

export async function getSizesAndAddons(from: string, to: string): Promise<SizeAddonRow[]> {
  const c = await db();
  return rows(
    await c.rpc("report_sizes_and_addons", { p_from: from, p_to: to }),
    "sizes and add-ons",
  ).map((r: Record<string, unknown>) => ({
    kind: str(r.kind) === "addon" ? "addon" : "size",
    parent: str(r.product),
    name: str(r.name),
    qty: num(r.qty),
    lines: num(r.lines),
    sales: num(r.sales),
    cost: num(r.cost),
    margin: num(r.margin),
    offered: numOrNull(r.offered),
  }));
}

/** One way of paying over some days (0042): what it took, what went back, the change it gave. */
export interface PaymentMethodRow {
  method: string;
  /** The sales it paid for, and of those, how many were paid another way too. */
  sales: number;
  splitSales: number;
  taken: number;
  changeGiven: number;
  /** Given back that way by the refunds made in the days. */
  refunded: number;
  net: number;
}

export async function getPaymentTakings(from: string, to: string): Promise<PaymentMethodRow[]> {
  const c = await db();
  return rows(await c.rpc("report_payments", { p_from: from, p_to: to }), "takings by payment").map(
    (r: Record<string, unknown>) => ({
      method: str(r.method),
      sales: num(r.sales),
      splitSales: num(r.split_sales),
      taken: num(r.taken),
      changeGiven: num(r.change_given),
      refunded: num(r.refunded),
      net: num(r.net),
    }),
  );
}

/** What was lost in the dates (0048): by kind and account, item, person and day, and each loss. */
export async function getLossReport(from: string, to: string): Promise<LossReport> {
  const c = await db();
  return lossReportFrom(
    one(await c.rpc("report_losses", { p_from: from, p_to: to }), "what was lost"),
  );
}
