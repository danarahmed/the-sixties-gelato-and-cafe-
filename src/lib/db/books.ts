import "server-only";
/**
 * Bookkeeping reads: the till by day, vendors and what is owed, expenses, the
 * journal register, periods and the audit trail. All run as the signed-in
 * person, so row-level security decides what they return.
 */
import { daysBetween } from "@/lib/dates";
import { db, num, numOrNull, one, rows, str, strOrNull } from "./client";

/* ------------------------------------------------------------------ sales */

export interface DailySalesRow {
  day: string;
  channel: string;
  orders: number;
  net: number;
  cogs: number;
  refunded: number;
}

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
      refunded: num(r.refunded),
    }),
  );
}

/** Trading days that sold and are not closed, oldest first, however long ago. */
export async function getUnclosedDays(): Promise<string[]> {
  const c = await db();
  return rows(await c.rpc("report_unclosed_days"), "the days not yet closed").map((r) =>
    str(r.day),
  );
}

export interface DayTotals {
  day: string;
  orders: number;
  cashSales: number;
  cashRefunds: number;
  card: number;
  platform: number;
  closed: boolean;
  /** Bills from the till still waiting for their money: the day cannot close until they are settled. */
  openBills: number;
}

/** What the till should hold for a day, before it is counted. */
export async function getDayTotals(day: string): Promise<DayTotals> {
  const c = await db();
  const t = one(
    await c.rpc("report_day_totals", { p_day: day }),
    `the totals for ${day}`,
  ) as Record<string, unknown> | null;
  return {
    day,
    orders: num(t?.orders),
    cashSales: num(t?.cash_sales),
    cashRefunds: num(t?.cash_refunds),
    card: num(t?.card),
    platform: num(t?.platform),
    closed: Boolean(t?.closed),
    openBills: num(t?.open_bills),
  };
}

export interface DayCloseRow {
  id: string;
  day: string;
  openingFloat: number;
  expectedCash: number;
  countedCash: number;
  variance: number;
  closedBy: string | null;
}

/** Trading days already closed off with a counted drawer. */
export async function getDayCloses(limit = 60): Promise<DayCloseRow[]> {
  const c = await db();
  const [shifts, people] = await Promise.all([
    c
      .from("work_shift")
      .select(
        "id,business_day,opened_at,opening_float,expected_cash,counted_cash,variance,opened_by",
      )
      .not("closed_at", "is", null)
      .order("business_day", { ascending: false, nullsFirst: false })
      .limit(limit),
    c.from("app_user").select("id,full_name"),
  ]);
  const person = new Map(rows(people, "people").map((p) => [str(p.id), str(p.full_name)]));
  return rows(shifts, "closed days").map((s) => ({
    id: str(s.id),
    day: s.business_day ? str(s.business_day) : str(s.opened_at).slice(0, 10),
    openingFloat: num(s.opening_float),
    expectedCash: num(s.expected_cash),
    countedCash: num(s.counted_cash),
    variance: num(s.variance),
    closedBy: s.opened_by ? (person.get(str(s.opened_by)) ?? null) : null,
  }));
}

/* ---------------------------------------------------------------- vendors */

export interface VendorLine {
  date: string;
  particulars: string;
  ref: string;
  charge: number;
  payment: number;
}

export interface VendorRow {
  id: string;
  name: string;
  contact: string | null;
  phone: string | null;
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
    c.from("supplier").select("id,name,contact,phone").eq("is_active", true).order("name"),
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
        ref: b.due_date ? `Due ${str(b.due_date)}` : "",
        charge: num(b.amount_total),
        payment: 0,
      })),
      ...cancelled.map((b) => ({
        date: str(b.invoice_date),
        particulars: `Bill ${str(b.invoice_no)} — cancelled: ${str(b.cancel_reason)}`,
        ref: `was ${num(b.amount_total).toLocaleString("en-US")}`,
        charge: 0,
        payment: 0,
      })),
      ...pays.map((p) => ({
        date: str(p.paid_on),
        particulars: `Payment${p.method ? ` — ${str(p.method)}` : ""}`,
        ref: "",
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
      billed,
      paid,
      balance: billed - paid,
      overdue,
      lines,
    };
  });
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
  const [lines, entries, accounts, people] = await Promise.all([
    c
      .from("journal_line")
      .select("journal_entry_id,account_id,debit")
      .in("journal_entry_id", entryIds),
    c.from("journal_entry").select("id,journal_no").in("id", entryIds),
    c.from("gl_account").select("id,code,name"),
    c.from("app_user").select("id,full_name"),
  ]);
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

/** The register of every journal, newest first — sales, bills and manual entries alike. */
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
    .order("occurred_at", { ascending: false })
    .order("journal_no", { ascending: false, nullsFirst: true })
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
  }));
}

/* ------------------------------------------------------------------ audit */

export interface AuditRow {
  id: string;
  at: string;
  action: string;
  entity: string;
  reason: string | null;
  by: string | null;
}

/** Who did what, when — written by the database in the same transaction (M-03). */
export async function getAuditLog(limit = 50): Promise<AuditRow[]> {
  const c = await db();
  const [log, people] = await Promise.all([
    c
      .from("audit_log")
      .select("id,occurred_at,action,entity_type,entity_id,reason,app_user_id")
      .order("occurred_at", { ascending: false })
      .limit(limit),
    c.from("app_user").select("id,full_name"),
  ]);
  const person = new Map(rows(people, "people").map((p) => [str(p.id), str(p.full_name)]));
  return rows(log, "the audit trail").map((a) => ({
    id: str(a.id),
    at: str(a.occurred_at),
    action: str(a.action),
    entity: `${str(a.entity_type)} ${str(a.entity_id).slice(0, 8)}`.trim(),
    reason: strOrNull(a.reason),
    by: a.app_user_id ? (person.get(str(a.app_user_id)) ?? null) : null,
  }));
}
