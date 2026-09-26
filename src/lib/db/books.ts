import "server-only";
/**
 * Bookkeeping reads: the till by day, vendors and what is owed, expenses, the
 * journal register, periods and the audit trail. All run as the signed-in
 * person, so row-level security decides what they return.
 */
import {
  actionLabel,
  auditGroup,
  describeChanges,
  subjectOf,
  type Change,
  type Json,
} from "@/lib/audit";
import { daysBetween } from "@/lib/dates";
import { channelName } from "@/lib/channels";
import { db, num, numOrNull, one, rows, str, strOrNull } from "./client";
import { getChannels } from "./channels";

/* ------------------------------------------------------------------ sales */

export interface DailySalesRow {
  day: string;
  channel: string;
  /** Sales that day (voids excluded), and what they took and cost. */
  orders: number;
  net: number;
  cogs: number;
  /**
   * Refunds made that day against the channel's sales, whenever the sale was,
   * and the cost of what went back on the shelf (0026): the ledger's basis,
   * so net sales here are the P&L's net revenue.
   */
  refunds: number;
  returnedCost: number;
}

export { salesTotals } from "./salesTotals";

/** One row per trading day and channel, in the business's own timezone (H-09). */
export async function getDailySales(from: string, to: string): Promise<DailySalesRow[]> {
  const c = await db();
  return rows(await c.rpc("report_daily_sales", { p_from: from, p_to: to }), "daily sales").map(
    (r: Record<string, unknown>) => ({
      day: str(r.day),
      channel: str(r.channel),
      orders: num(r.orders),
      net: num(r.net),
      cogs: num(r.cogs),
      refunds: num(r.refunds),
      returnedCost: num(r.returned_cost),
    }),
  );
}

/** Trading days whose cash has not been counted, oldest first, however long ago. */
export async function getUnclosedDays(): Promise<string[]> {
  const c = await db();
  return rows(await c.rpc("report_unclosed_days"), "the days not yet counted").map((r) =>
    str(r.day),
  );
}

/** The drawer now: what the last count left in it, and the cash in and out since. */
export interface DrawerStatus {
  /** When the drawer was last counted; null before the first count. */
  since: string | null;
  /** What the last count left in the drawer; null when the first count must be told. */
  start: number | null;
  needsStart: boolean;
  cashSales: number;
  refunds: number;
  voids: number;
  paidOut: number;
  cashIn: number;
  cashOut: number;
  /** Every cash movement since the last count, signed. */
  moved: number;
  /** What the drawer should hold; null until its start is known. */
  expected: number | null;
  orders: number;
  card: number;
  platform: number;
  /** Bills still waiting for their money: the drawer is counted once they are settled. */
  openBills: number;
  safe: number;
}

export async function getDrawerStatus(): Promise<DrawerStatus> {
  const c = await db();
  const t = one(await c.rpc("drawer_status"), "the drawer") as Record<string, unknown> | null;
  return {
    since: strOrNull(t?.since),
    start: numOrNull(t?.start),
    needsStart: Boolean(t?.needs_start),
    cashSales: num(t?.cash_sales),
    refunds: num(t?.refunds),
    voids: num(t?.voids),
    paidOut: num(t?.paid_out),
    cashIn: num(t?.cash_in),
    cashOut: num(t?.cash_out),
    moved: num(t?.moved),
    expected: numOrNull(t?.expected),
    orders: num(t?.orders),
    card: num(t?.card),
    platform: num(t?.platform),
    openBills: num(t?.open_bills),
    safe: num(t?.safe),
  };
}

export interface DrawerCountRow {
  id: string;
  /** When it was counted. */
  at: string;
  /** The count before it: what this one covers starts there. */
  from: string | null;
  /** Counted the old way, one calendar day at a time. */
  byDay: boolean;
  day: string | null;
  start: number;
  expected: number;
  counted: number;
  variance: number;
  left: number | null;
  taken: number | null;
  takenTo: string | null;
  by: string | null;
}

/** Drawer counts, newest first: each covers the cash since the one before. */
export async function getDrawerCounts(limit = 60): Promise<DrawerCountRow[]> {
  const c = await db();
  const [shifts, people] = await Promise.all([
    c
      .from("work_shift")
      .select(
        "id,kind,business_day,covers_from,closed_at,opening_float,expected_cash,counted_cash,variance,left_in_drawer,taken_out,taken_to,opened_by",
      )
      .not("closed_at", "is", null)
      .order("closed_at", { ascending: false })
      .limit(limit),
    c.from("app_user").select("id,full_name"),
  ]);
  const person = new Map(rows(people, "people").map((p) => [str(p.id), str(p.full_name)]));
  return rows(shifts, "drawer counts").map((s) => ({
    id: str(s.id),
    at: str(s.closed_at),
    from: strOrNull(s.covers_from),
    byDay: str(s.kind) === "day",
    day: strOrNull(s.business_day),
    start: num(s.opening_float),
    expected: num(s.expected_cash),
    counted: num(s.counted_cash),
    variance: num(s.variance),
    left: numOrNull(s.left_in_drawer),
    taken: numOrNull(s.taken_out),
    takenTo: strOrNull(s.taken_to),
    by: s.opened_by ? (person.get(str(s.opened_by)) ?? null) : null,
  }));
}

/* ---------------------------------------------------------------- vendors */

/** How a supplier was paid, in words (0024 names where the money came from). */
const PAID_BY: Record<string, string> = {
  till: "from the till",
  cash: "cash",
  safe: "from the safe",
  bank: "by bank",
  transfer: "by bank",
  card: "by card",
  owner: "paid by the owner",
};

export interface VendorLine {
  date: string;
  /** What the line is, in English: the screen shows it through msg(). */
  particulars: string;
  /** Its note, as a phrase and its values: the screen shows it through t(). */
  ref: { text: string; vars: Record<string, string> } | null;
  charge: number;
  payment: number;
}

export interface VendorRow {
  id: string;
  name: string;
  contact: string | null;
  phone: string | null;
  /** Out of use (0027): kept for its history; nothing more is received from them. */
  isActive: boolean;
  /** Days a delivery takes, for "running out" (0029); null: the café's default. */
  leadTimeDays: number | null;
  billed: number;
  paid: number;
  balance: number;
  overdue: number;
  lines: VendorLine[];
}

export interface OpenBill {
  id: string;
  supplierId: string;
  supplierName: string;
  invoiceNo: string;
  invoiceDate: string;
  dueDate: string | null;
  total: number;
  paid: number;
  outstanding: number;
  daysOverdue: number;
}

/**
 * Vendors, their statements, and their unpaid bills. Both the balances and
 * the ageing come from the same rows — bills and the payments against them —
 * so the two screens can no longer disagree (audit M-08); the reconciliation
 * report proves the total against Accounts payable (2000).
 */
export async function getVendorBook(
  today: string,
): Promise<{ vendors: VendorRow[]; openBills: OpenBill[] }> {
  const c = await db();
  const [suppliers, bills, payments] = await Promise.all([
    c.from("supplier").select("id,name,contact,phone,is_active,lead_time_days").order("name"),
    c
      .from("purchase_invoice")
      .select(
        "id,supplier_id,invoice_no,invoice_date,due_date,amount_total,paid_amount,legacy,cancelled_at,cancel_reason",
      )
      .order("invoice_date"),
    c
      .from("supplier_payment")
      .select("id,supplier_id,purchase_invoice_id,amount,paid_on,method")
      .order("paid_on"),
  ]);
  const allBills = rows(bills, "bills");
  // A cancelled bill stays on the statement for the record, but is not owed.
  const billRows = allBills.filter((b) => !b.cancelled_at);
  const payRows = rows(payments, "payments");
  const supplierRows = rows(suppliers, "suppliers");
  const name = new Map(supplierRows.map((s) => [str(s.id), str(s.name)]));

  const paidByBill = new Map<string, number>();
  for (const p of payRows) {
    if (p.purchase_invoice_id) {
      const k = str(p.purchase_invoice_id);
      paidByBill.set(k, (paidByBill.get(k) ?? 0) + num(p.amount));
    }
  }

  const openBills: OpenBill[] = billRows
    .map((b) => {
      const total = num(b.amount_total);
      const paid = paidByBill.get(str(b.id)) ?? 0;
      const due = strOrNull(b.due_date);
      return {
        id: str(b.id),
        supplierId: str(b.supplier_id),
        supplierName: name.get(str(b.supplier_id)) ?? "—",
        invoiceNo: str(b.invoice_no),
        invoiceDate: str(b.invoice_date),
        dueDate: due,
        total,
        paid,
        outstanding: total - paid,
        daysOverdue: due ? Math.max(0, daysBetween(due, today)) : 0,
      };
    })
    .filter((b) => b.outstanding > 0)
    .sort((a, b) => b.daysOverdue - a.daysOverdue);

  const vendors: VendorRow[] = supplierRows.map((s) => {
    const id = str(s.id);
    const mine = billRows.filter((b) => str(b.supplier_id) === id);
    const cancelled = allBills.filter((b) => b.cancelled_at && str(b.supplier_id) === id);
    const pays = payRows.filter((p) => str(p.supplier_id) === id);
    const lines: VendorLine[] = [
      ...mine.map((b) => ({
        date: str(b.invoice_date),
        particulars: `Bill ${str(b.invoice_no)}`.trim() + (b.legacy ? " (before controls)" : ""),
        ref: b.due_date ? { text: "Due {date}", vars: { date: str(b.due_date) } } : null,
        charge: num(b.amount_total),
        payment: 0,
      })),
      ...cancelled.map((b) => ({
        date: str(b.invoice_date),
        particulars: `Bill ${str(b.invoice_no)} — cancelled: ${str(b.cancel_reason)}`,
        ref: {
          text: "was {amount}",
          vars: { amount: num(b.amount_total).toLocaleString("en-US") },
        },
        charge: 0,
        payment: 0,
      })),
      ...pays.map((p) => ({
        date: str(p.paid_on),
        particulars: `Payment${p.method ? ` — ${PAID_BY[str(p.method)] ?? str(p.method)}` : ""}`,
        ref: null,
        charge: 0,
        payment: num(p.amount),
      })),
    ].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    const billed = mine.reduce((t, b) => t + num(b.amount_total), 0);
    const paid = pays.reduce((t, p) => t + num(p.amount), 0);
    const overdue = openBills
      .filter((b) => b.supplierId === id && b.daysOverdue > 0)
      .reduce((t, b) => t + b.outstanding, 0);
    return {
      id,
      name: str(s.name),
      contact: strOrNull(s.contact),
      phone: strOrNull(s.phone),
      isActive: s.is_active !== false,
      leadTimeDays: s.lead_time_days == null ? null : num(s.lead_time_days),
      billed,
      paid,
      balance: billed - paid,
      overdue,
      lines,
    };
  });
  // Those out of use last: kept for their history.
  vendors.sort((x, y) => Number(y.isActive) - Number(x.isActive));
  return { vendors, openBills };
}

/** Ageing buckets over the open bills. */
export function ageBills(bills: OpenBill[]) {
  const buckets = { current: 0, d1_15: 0, d16_30: 0, d31plus: 0, total: 0 };
  for (const b of bills) {
    buckets.total += b.outstanding;
    if (b.daysOverdue <= 0) buckets.current += b.outstanding;
    else if (b.daysOverdue <= 15) buckets.d1_15 += b.outstanding;
    else if (b.daysOverdue <= 30) buckets.d16_30 += b.outstanding;
    else buckets.d31plus += b.outstanding;
  }
  return buckets;
}

/* --------------------------------------------------------------- expenses */

export interface ExpenseRow {
  id: string;
  date: string;
  description: string;
  amount: number;
  account: string;
  journalNo: number | null;
  by: string | null;
  /** The journal that reversed it: a reversed expense is no longer spent (audit P1-2). */
  reversedBy: number | null;
}

export async function getExpenses(limit = 100): Promise<ExpenseRow[]> {
  const c = await db();
  const expenses = rows(
    await c
      .from("expense")
      .select("id,amount,description,incurred_on,journal_entry_id,created_by")
      .order("incurred_on", { ascending: false })
      .limit(limit),
    "expenses",
  );
  if (expenses.length === 0) return [];
  const entryIds = expenses
    .map((e) => e.journal_entry_id)
    .filter(Boolean)
    .map(String);
  const [lines, entries, accounts, people, reversals] = await Promise.all([
    c
      .from("journal_line")
      .select("journal_entry_id,account_id,debit")
      .in("journal_entry_id", entryIds),
    c.from("journal_entry").select("id,journal_no").in("id", entryIds),
    c.from("gl_account").select("id,code,name"),
    c.from("app_user").select("id,full_name"),
    c
      .from("journal_entry")
      .select("reverses_entry,journal_no")
      .eq("status", "published")
      .in("reverses_entry", entryIds),
  ]);
  const reversedBy = new Map(
    rows(reversals, "reversals").map((r) => [str(r.reverses_entry), numOrNull(r.journal_no)]),
  );
  const label = new Map(
    rows(accounts, "accounts").map((a) => [str(a.id), `${str(a.code)} ${str(a.name)}`]),
  );
  const debited = new Map<string, string>();
  for (const l of rows(lines, "expense journal lines")) {
    if (num(l.debit) > 0) debited.set(str(l.journal_entry_id), label.get(str(l.account_id)) ?? "—");
  }
  const journalNo = new Map(
    rows(entries, "expense journals").map((e) => [str(e.id), numOrNull(e.journal_no)]),
  );
  const person = new Map(rows(people, "people").map((p) => [str(p.id), str(p.full_name)]));
  return expenses.map((e) => ({
    id: str(e.id),
    date: str(e.incurred_on),
    description: str(e.description) || "—",
    amount: num(e.amount),
    account: e.journal_entry_id ? (debited.get(str(e.journal_entry_id)) ?? "—") : "—",
    journalNo: e.journal_entry_id ? (journalNo.get(str(e.journal_entry_id)) ?? null) : null,
    by: e.created_by ? (person.get(str(e.created_by)) ?? null) : null,
    reversedBy: e.journal_entry_id ? (reversedBy.get(str(e.journal_entry_id)) ?? null) : null,
  }));
}

/* --------------------------------------------------------------- journals */

export interface AccountRow {
  id: string;
  code: string;
  name: string;
  type: string;
  isActive: boolean;
}

/**
 * The café's own number the next bill will be given if its box is left as
 * filled (SGC-2026-0001 …). Only a look: the number is taken when the bill is
 * saved, so two people never get the same one.
 */
export async function getNextBillNumber(): Promise<string> {
  const c = await db();
  return str(one<string>(await c.rpc("next_bill_number"), "the next bill number"));
}

export async function getGlAccounts(): Promise<AccountRow[]> {
  const c = await db();
  return rows(
    await c.from("gl_account").select("id,code,name,account_type,is_active").order("code"),
    "accounts",
  ).map((a) => ({
    id: str(a.id),
    code: str(a.code),
    name: str(a.name),
    type: str(a.account_type),
    isActive: Boolean(a.is_active),
  }));
}

export interface JournalRegisterRow {
  id: string;
  journalNo: number | null;
  occurredAt: string;
  referenceNo: string | null;
  referenceType: string | null;
  notes: string;
  status: string;
  legacy: boolean;
  /** No record stands behind it, so it may be reversed by hand (the database's rule too). */
  reversibleByHand: boolean;
  amount: number;
  createdBy: string;
  reversesNo: number | null;
  reversedByNo: number | null;
  lines: { account: string; memo: string | null; debit: number; credit: number }[];
}

/**
 * Entries no record stands behind. A journal a sale, receipt, bill, payment,
 * stock movement, count or day close wrote is corrected through that record,
 * so the database refuses to reverse it by hand; entries from before the
 * controls may always be reversed (migration 0015, reverse_journal).
 */
const REVERSIBLE_BY_HAND = new Set(["manual", "correction", "expense", "year_end_close"]);

/**
 * The register of every journal — sales, bills and manual entries alike — by
 * journal number, newest first (1054, 1053, 1052 …). Drafts have no number
 * until they are published, so they come first, where they wait for action.
 */
export async function getJournalRegister(
  limit = 150,
  onlyManual = false,
): Promise<JournalRegisterRow[]> {
  const c = await db();
  let q = c
    .from("journal_entry")
    .select(
      "id,journal_no,description,reference_no,reference_type,status,occurred_at,posted_by,legacy,reverses_entry",
    )
    .order("journal_no", { ascending: false, nullsFirst: true })
    .order("occurred_at", { ascending: false })
    .limit(limit);
  if (onlyManual) q = q.in("reference_type", ["manual", "reversal"]);
  const entries = rows(await q, "journals");
  if (entries.length === 0) return [];
  const ids = entries.map((e) => str(e.id));
  const [lines, accounts, people, reversals, reversed] = await Promise.all([
    c
      .from("journal_line")
      .select("journal_entry_id,account_id,debit,credit,memo")
      .in("journal_entry_id", ids),
    c.from("gl_account").select("id,code,name"),
    c.from("app_user").select("id,full_name"),
    c.from("journal_entry").select("reverses_entry,journal_no").in("reverses_entry", ids),
    c
      .from("journal_entry")
      .select("id,journal_no")
      .in(
        "id",
        entries
          .map((e) => e.reverses_entry)
          .filter(Boolean)
          .map(String),
      ),
  ]);
  const account = new Map(
    rows(accounts, "accounts").map((a) => [str(a.id), `${str(a.code)} ${str(a.name)}`]),
  );
  const person = new Map(rows(people, "people").map((p) => [str(p.id), str(p.full_name)]));
  const reversedBy = new Map(
    rows(reversals, "reversals").map((r) => [str(r.reverses_entry), numOrNull(r.journal_no)]),
  );
  const numberOf = new Map(
    rows(reversed, "reversed journals").map((r) => [str(r.id), numOrNull(r.journal_no)]),
  );
  const byEntry = new Map<string, JournalRegisterRow["lines"]>();
  for (const l of rows(lines, "journal lines")) {
    const k = str(l.journal_entry_id);
    byEntry.set(k, [
      ...(byEntry.get(k) ?? []),
      {
        account: account.get(str(l.account_id)) ?? "—",
        memo: strOrNull(l.memo),
        debit: num(l.debit),
        credit: num(l.credit),
      },
    ]);
  }
  return entries.map((e) => {
    const id = str(e.id);
    const ls = byEntry.get(id) ?? [];
    return {
      id,
      journalNo: numOrNull(e.journal_no),
      occurredAt: str(e.occurred_at),
      referenceNo: strOrNull(e.reference_no),
      referenceType: strOrNull(e.reference_type),
      notes: str(e.description),
      status: str(e.status) || "published",
      legacy: Boolean(e.legacy),
      reversibleByHand: Boolean(e.legacy) || REVERSIBLE_BY_HAND.has(str(e.reference_type)),
      amount: ls.reduce((t, l) => t + l.debit, 0),
      createdBy: e.posted_by ? (person.get(str(e.posted_by)) ?? "—") : "—",
      reversesNo: e.reverses_entry ? (numberOf.get(str(e.reverses_entry)) ?? null) : null,
      reversedByNo: reversedBy.get(id) ?? null,
      lines: ls.sort((a, b) => b.debit - a.debit),
    };
  });
}

/** The number the next published journal will get (indicative: assigned on publish). */
export async function getNextJournalNo(): Promise<number | null> {
  const c = await db();
  const r = one(
    await c.from("document_counter").select("next_no").eq("doc_type", "journal").maybeSingle(),
    "the journal counter",
  );
  return r ? num(r.next_no) : null;
}

/* ---------------------------------------------------------------- periods */

export interface PeriodRow {
  id: string;
  name: string;
  startsOn: string;
  endsOn: string;
  status: string;
  lockedAt: string | null;
  lockedBy: string | null;
}

export async function getPeriods(): Promise<PeriodRow[]> {
  const c = await db();
  const [periods, people] = await Promise.all([
    c
      .from("accounting_period")
      .select("id,name,starts_on,ends_on,status,locked_at,locked_by")
      .order("starts_on", {
        ascending: false,
      }),
    c.from("app_user").select("id,full_name"),
  ]);
  const person = new Map(rows(people, "people").map((p) => [str(p.id), str(p.full_name)]));
  return rows(periods, "accounting periods").map((p) => ({
    id: str(p.id),
    name: str(p.name),
    startsOn: str(p.starts_on),
    endsOn: str(p.ends_on),
    status: str(p.status),
    lockedAt: strOrNull(p.locked_at),
    lockedBy: p.locked_by ? (person.get(str(p.locked_by)) ?? null) : null,
  }));
}

/** The period a day falls in, if one exists yet (periods are created as they are used). */
export function periodFor(periods: PeriodRow[], day: string): PeriodRow | null {
  return periods.find((p) => p.startsOn <= day && day <= p.endsOn) ?? null;
}

export interface CheckRow {
  key: string;
  label: string;
  ok: boolean;
  detail: string | null;
  /** False for a warning: the owner should know, but it does not stop the lock (0025). */
  blocks: boolean;
}

/** Every check a period must pass before it may be locked (audit H-08). */
export async function getCloseChecklist(periodId: string): Promise<CheckRow[]> {
  const c = await db();
  return rows(
    await c.rpc("period_close_checklist", { p_period: periodId }),
    "the closing checklist",
  ).map((r: Record<string, unknown>) => ({
    key: str(r.check_key),
    label: str(r.label),
    ok: Boolean(r.ok),
    detail: strOrNull(r.detail),
    blocks: r.blocks !== false,
  }));
}

/* ------------------------------------------------------------------ audit */

export interface AuditEntry {
  id: string;
  at: string;
  action: string;
  /** What happened, in words. */
  label: string;
  /** What it was about, by name. */
  subject: string;
  /** Who was signed in; null for a change made in the database itself. */
  by: string | null;
  reason: string | null;
  changes: Change[];
  before: Json;
  after: Json;
}

export interface AuditFilter {
  fromTs: string;
  toTs: string;
  /** One of AUDIT_GROUPS, or everything. */
  group?: string | null;
  /** A person's id, or "none" for changes made with no one signed in. */
  person?: string | null;
}

const AUDIT_PAGE = 1000;

/**
 * The names the trail refers to: stock items, products and what the till
 * sells, suppliers, categories, places, recipes, delivery platforms and
 * people; and each channel's, under "channel:" and its code.
 */
async function auditNames(): Promise<{ names: Map<string, string>; people: Map<string, string> }> {
  const c = await db();
  const [
    items,
    products,
    variants,
    suppliers,
    categories,
    locations,
    recipes,
    platforms,
    people,
    channels,
  ] = await Promise.all([
    c.from("item").select("id,name"),
    c.from("product").select("id,name"),
    c.from("product_variant").select("id,product_id,name"),
    c.from("supplier").select("id,name"),
    c.from("product_category").select("id,name"),
    c.from("location").select("id,name"),
    c.from("recipe").select("id,name"),
    c.from("delivery_platform").select("id,name"),
    c.from("app_user").select("id,full_name"),
    getChannels(),
  ]);
  const names = new Map<string, string>();
  for (const [res, what] of [
    [items, "items"],
    [products, "products"],
    [suppliers, "suppliers"],
    [categories, "categories"],
    [locations, "locations"],
    [recipes, "recipes"],
    [platforms, "delivery platforms"],
  ] as const) {
    for (const r of rows(res, what)) names.set(str(r.id), str(r.name));
  }
  for (const ch of channels) names.set(`channel:${ch.code}`, channelName(channels, ch.code));
  const productName = new Map(rows(products, "products").map((p) => [str(p.id), str(p.name)]));
  for (const v of rows(variants, "product variants")) {
    const pn = productName.get(str(v.product_id)) ?? "";
    const vn = str(v.name);
    names.set(str(v.id), pn && pn !== vn ? `${pn} — ${vn}` : vn || pn);
  }
  const person = new Map(rows(people, "people").map((p) => [str(p.id), str(p.full_name)]));
  for (const [id, n] of person) names.set(id, n);
  return { names, people: person };
}

/**
 * Who changed what (0027, the audit's P1-1): the trail between two instants,
 * newest first, narrowed to a kind of change or a person, each row with what
 * it was about and its values before and after. Needs audit.view (row-level
 * security returns nothing otherwise). Read a page at a time, up to `max`.
 */
export async function getAuditTrail(
  filter: AuditFilter,
  max = 500,
): Promise<{ entries: AuditEntry[]; more: boolean; people: { id: string; name: string }[] }> {
  const c = await db();
  const { names, people } = await auditNames();
  const group = auditGroup(filter.group ?? undefined);
  const entries: AuditEntry[] = [];
  let more = true;
  for (let start = 0; start < max; start += AUDIT_PAGE) {
    const size = Math.min(AUDIT_PAGE, max - start);
    let q = c
      .from("audit_log")
      .select(
        "id,occurred_at,action,entity_type,entity_id,reason,app_user_id,before_state,after_state",
      )
      .gte("occurred_at", filter.fromTs)
      .lt("occurred_at", filter.toTs);
    if (group) {
      // An action in the group: "price.*", or one action named in full.
      q = q.or(
        group.prefixes
          .map((p) => `action.like.${JSON.stringify(p.endsWith(".") ? `${p}*` : p)}`)
          .join(","),
      );
    }
    if (filter.person === "none") q = q.is("app_user_id", null);
    else if (filter.person) q = q.eq("app_user_id", filter.person);
    const page = rows(
      await q
        .order("occurred_at", { ascending: false })
        .order("id", { ascending: false })
        .range(start, start + size - 1),
      "the audit trail",
    );
    for (const a of page) {
      const before = (a.before_state ?? null) as Json;
      const after = (a.after_state ?? null) as Json;
      const entityId = strOrNull(a.entity_id);
      entries.push({
        id: str(a.id),
        at: str(a.occurred_at),
        action: str(a.action),
        label: actionLabel(str(a.action)),
        subject: subjectOf(str(a.entity_type), entityId, before, after, names),
        by: a.app_user_id ? (people.get(str(a.app_user_id)) ?? "Someone") : null,
        reason: strOrNull(a.reason),
        changes: describeChanges(before, after, names),
        before,
        after,
      });
    }
    if (page.length < size) {
      more = false;
      break;
    }
  }
  return {
    entries,
    more,
    people: [...people]
      .map(([id, name]) => ({ id, name }))
      .sort((x, y) => x.name.localeCompare(y.name)),
  };
}
