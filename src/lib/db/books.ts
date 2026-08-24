/**
 * Bookkeeping reads: daily sales summaries (what the accountant sees, one line
 * per trading day per channel), vendor statements with payable ageing, and the
 * expense register. All scoped to the demo business by RLS.
 */
import { getSupabase, DEMO_BUSINESS_ID } from "@/lib/supabase/client";

const biz = DEMO_BUSINESS_ID;

/* ------------------------------------------------------------------ sales */

export interface DailySalesRow {
  day: string; // YYYY-MM-DD
  channel: string;
  orders: number;
  gross: number;
  discount: number;
  net: number;
  cogs: number;
}

export interface DayTotals {
  day: string;
  orders: number;
  net: number;
  cogs: number;
  cash: number; // tenders recorded as cash
  card: number;
  platform: number;
}

/** One row per (day, channel) — the accountant's view of the till. */
export async function getDailySales(limitDays = 30): Promise<DailySalesRow[]> {
  const db = getSupabase();
  if (!db) return [];
  const { data, error } = await db
    .from("sales_order")
    .select("placed_at,channel,gross_amount,discount_amount,net_amount,cogs_amount,status")
    .eq("business_id", biz)
    .order("placed_at", { ascending: false })
    .limit(2000);
  if (error) throw new Error(error.message);

  const map = new Map<string, DailySalesRow>();
  for (const o of data ?? []) {
    if (String(o.status) === "voided") continue;
    const day = String(o.placed_at).slice(0, 10);
    const channel = String(o.channel);
    const key = day + "|" + channel;
    const row =
      map.get(key) ?? { day, channel, orders: 0, gross: 0, discount: 0, net: 0, cogs: 0 };
    row.orders += 1;
    row.gross += Number(o.gross_amount ?? 0);
    row.discount += Number(o.discount_amount ?? 0);
    row.net += Number(o.net_amount ?? 0);
    row.cogs += Number(o.cogs_amount ?? 0);
    map.set(key, row);
  }
  const rows = [...map.values()].sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0));
  const days = [...new Set(rows.map((r) => r.day))].slice(0, limitDays);
  return rows.filter((r) => days.includes(r.day));
}

/** Totals for one day, including how it was tendered (for the cash count). */
export async function getDayTotals(day: string): Promise<DayTotals> {
  const empty: DayTotals = { day, orders: 0, net: 0, cogs: 0, cash: 0, card: 0, platform: 0 };
  const db = getSupabase();
  if (!db) return empty;

  const ordersR = await db
    .from("sales_order")
    .select("id,net_amount,cogs_amount,status")
    .eq("business_id", biz)
    .gte("placed_at", `${day}T00:00:00Z`)
    .lte("placed_at", `${day}T23:59:59Z`);
  if (ordersR.error) throw new Error(ordersR.error.message);
  const orders = (ordersR.data ?? []).filter((o) => String(o.status) !== "voided");
  if (orders.length === 0) return empty;

  const ids = orders.map((o) => String(o.id));
  const tendersR = await db
    .from("sales_tender")
    .select("sales_order_id,tender_type,amount")
    .in("sales_order_id", ids);

  const totals: DayTotals = {
    day,
    orders: orders.length,
    net: orders.reduce((s, o) => s + Number(o.net_amount ?? 0), 0),
    cogs: orders.reduce((s, o) => s + Number(o.cogs_amount ?? 0), 0),
    cash: 0,
    card: 0,
    platform: 0,
  };
  for (const t of tendersR.data ?? []) {
    const amount = Number(t.amount ?? 0);
    const type = String(t.tender_type);
    if (type === "cash") totals.cash += amount;
    else if (type === "card") totals.card += amount;
    else totals.platform += amount;
  }
  return totals;
}

export interface DayCloseRow {
  id: string;
  day: string;
  expectedCash: number;
  countedCash: number;
  variance: number;
}

/** Days already closed off with a till count (work_shift carries the count). */
export async function getDayCloses(): Promise<DayCloseRow[]> {
  const db = getSupabase();
  if (!db) return [];
  const { data, error } = await db
    .from("work_shift")
    .select("id,opened_at,closed_at,expected_cash,counted_cash,variance")
    .eq("business_id", biz)
    .not("closed_at", "is", null)
    .order("opened_at", { ascending: false })
    .limit(60);
  if (error) return [];
  return (data ?? []).map((s) => ({
    id: String(s.id),
    day: String(s.opened_at).slice(0, 10),
    expectedCash: Number(s.expected_cash ?? 0),
    countedCash: Number(s.counted_cash ?? 0),
    variance: Number(s.variance ?? 0),
  }));
}

/* ---------------------------------------------------------------- vendors */

export interface VendorLine {
  date: string;
  particulars: string;
  ref: string;
  charge: number; // bill raised (+)
  payment: number; // paid (−)
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

function daysBetween(from: string, to: Date): number {
  const d = new Date(from + "T00:00:00Z").getTime();
  return Math.floor((to.getTime() - d) / 86400000);
}

/** Vendors with their statement lines and what is overdue. */
export async function getVendors(): Promise<VendorRow[]> {
  const db = getSupabase();
  if (!db) return [];
  const [supR, billR, payR] = await Promise.all([
    db
      .from("supplier")
      .select("id,name,contact,phone,is_active")
      .eq("business_id", biz)
      .eq("is_active", true)
      .order("name"),
    db
      .from("purchase_invoice")
      .select("id,supplier_id,invoice_no,invoice_date,due_date,amount_total,paid_amount,is_paid")
      .eq("business_id", biz),
    db
      .from("supplier_payment")
      .select("id,supplier_id,amount,paid_on,method,purchase_invoice_id")
      .eq("business_id", biz),
  ]);
  if (supR.error) throw new Error(supR.error.message);

  const today = new Date();
  return (supR.data ?? []).map((s) => {
    const id = String(s.id);
    const bills = (billR.data ?? []).filter((b) => String(b.supplier_id) === id);
    const pays = (payR.data ?? []).filter((p) => String(p.supplier_id) === id);

    const lines: VendorLine[] = [
      ...bills.map((b) => ({
        date: String(b.invoice_date ?? "").slice(0, 10),
        particulars: `Bill ${b.invoice_no ?? ""}`.trim(),
        ref: b.due_date ? `Due ${String(b.due_date).slice(0, 10)}` : "",
        charge: Number(b.amount_total ?? 0),
        payment: 0,
      })),
      ...pays.map((p) => ({
        date: String(p.paid_on ?? "").slice(0, 10),
        particulars: `Payment${p.method ? ` — ${p.method}` : ""}`,
        ref: "",
        charge: 0,
        payment: Number(p.amount ?? 0),
      })),
    ].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

    const billed = bills.reduce((s2, b) => s2 + Number(b.amount_total ?? 0), 0);
    const paid = pays.reduce((s2, p) => s2 + Number(p.amount ?? 0), 0);
    const overdue = bills.reduce((s2, b) => {
      const outstanding = Number(b.amount_total ?? 0) - Number(b.paid_amount ?? 0);
      if (outstanding <= 0 || !b.due_date) return s2;
      return daysBetween(String(b.due_date).slice(0, 10), today) > 0 ? s2 + outstanding : s2;
    }, 0);

    return {
      id,
      name: String(s.name),
      contact: s.contact ? String(s.contact) : null,
      phone: s.phone ? String(s.phone) : null,
      billed,
      paid,
      balance: billed - paid,
      overdue,
      lines,
    };
  });
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

/** Unpaid bills, for the payable-ageing view. */
export async function getOpenBills(): Promise<OpenBill[]> {
  const db = getSupabase();
  if (!db) return [];
  const [billR, supR] = await Promise.all([
    db
      .from("purchase_invoice")
      .select("id,supplier_id,invoice_no,invoice_date,due_date,amount_total,paid_amount")
      .eq("business_id", biz)
      .order("due_date"),
    db.from("supplier").select("id,name").eq("business_id", biz),
  ]);
  if (billR.error) return [];
  const names = new Map<string, string>();
  for (const s of supR.data ?? []) names.set(String(s.id), String(s.name));
  const today = new Date();

  return (billR.data ?? [])
    .map((b) => {
      const total = Number(b.amount_total ?? 0);
      const paid = Number(b.paid_amount ?? 0);
      const due = b.due_date ? String(b.due_date).slice(0, 10) : null;
      return {
        id: String(b.id),
        supplierId: String(b.supplier_id),
        supplierName: names.get(String(b.supplier_id)) ?? "—",
        invoiceNo: String(b.invoice_no ?? ""),
        invoiceDate: String(b.invoice_date ?? "").slice(0, 10),
        dueDate: due,
        total,
        paid,
        outstanding: total - paid,
        daysOverdue: due ? Math.max(0, daysBetween(due, today)) : 0,
      };
    })
    .filter((b) => b.outstanding > 0.5);
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
  hasJournal: boolean;
}

export async function getExpenses(limit = 100): Promise<ExpenseRow[]> {
  const db = getSupabase();
  if (!db) return [];
  const expR = await db
    .from("expense")
    .select("id,amount,description,incurred_on,journal_entry_id")
    .eq("business_id", biz)
    .order("incurred_on", { ascending: false })
    .limit(limit);
  if (expR.error) return [];
  const rows = expR.data ?? [];
  if (rows.length === 0) return [];

  // Resolve the debited account from each expense's journal entry.
  const entryIds = rows.map((r) => r.journal_entry_id).filter(Boolean) as string[];
  const account = new Map<string, string>();
  if (entryIds.length > 0) {
    const [lineR, accR] = await Promise.all([
      db.from("journal_line").select("journal_entry_id,account_id,debit").in("journal_entry_id", entryIds),
      db.from("gl_account").select("id,code,name").eq("business_id", biz),
    ]);
    const label = new Map<string, string>();
    for (const a of accR.data ?? []) label.set(String(a.id), `${a.code} ${a.name}`);
    for (const l of lineR.data ?? []) {
      if (Number(l.debit ?? 0) > 0) account.set(String(l.journal_entry_id), label.get(String(l.account_id)) ?? "—");
    }
  }

  return rows.map((r) => ({
    id: String(r.id),
    date: String(r.incurred_on ?? "").slice(0, 10),
    description: r.description ? String(r.description) : "—",
    amount: Number(r.amount ?? 0),
    account: r.journal_entry_id ? (account.get(String(r.journal_entry_id)) ?? "—") : "—",
    hasJournal: Boolean(r.journal_entry_id),
  }));
}

/* --------------------------------------------------------------- journals */

export interface JournalRegisterRow {
  id: string;
  journalNo: number | null;
  date: string;
  referenceNo: string | null;
  notes: string;
  status: string;
  amount: number;
  createdBy: string;
  lines: { account: string; description: string | null; debit: number; credit: number }[];
}

/** The manual-journal register: one row per entry, newest first. */
export async function getJournalRegister(limit = 100): Promise<JournalRegisterRow[]> {
  const db = getSupabase();
  if (!db) return [];
  const jeR = await db
    .from("journal_entry")
    .select("id,journal_no,description,reference_no,status,occurred_at,posted_by")
    .eq("business_id", biz)
    .order("occurred_at", { ascending: false })
    .limit(limit);
  if (jeR.error) throw new Error(jeR.error.message);
  const entries = jeR.data ?? [];
  if (entries.length === 0) return [];

  const ids = entries.map((e) => String(e.id));
  const [lineR, accR, userR] = await Promise.all([
    db.from("journal_line").select("journal_entry_id,account_id,debit,credit,memo").in("journal_entry_id", ids),
    db.from("gl_account").select("id,code,name").eq("business_id", biz),
    db.from("app_user").select("id,full_name").eq("business_id", biz),
  ]);
  const acct = new Map<string, string>();
  for (const a of accR.data ?? []) acct.set(String(a.id), `${a.code} ${a.name}`);
  const person = new Map<string, string>();
  for (const u of userR.data ?? []) person.set(String(u.id), String(u.full_name));

  const byEntry = new Map<string, JournalRegisterRow["lines"]>();
  const total = new Map<string, number>();
  for (const l of lineR.data ?? []) {
    const key = String(l.journal_entry_id);
    const arr = byEntry.get(key) ?? [];
    arr.push({
      account: acct.get(String(l.account_id)) ?? "—",
      description: l.memo ? String(l.memo) : null,
      debit: Number(l.debit ?? 0),
      credit: Number(l.credit ?? 0),
    });
    byEntry.set(key, arr);
    total.set(key, (total.get(key) ?? 0) + Number(l.debit ?? 0));
  }

  return entries.map((e) => ({
    id: String(e.id),
    journalNo: e.journal_no === null ? null : Number(e.journal_no),
    date: String(e.occurred_at).slice(0, 10),
    referenceNo: e.reference_no ? String(e.reference_no) : null,
    notes: String(e.description ?? ""),
    status: String(e.status ?? "published"),
    amount: total.get(String(e.id)) ?? 0,
    createdBy: e.posted_by ? (person.get(String(e.posted_by)) ?? "—") : "—",
    lines: byEntry.get(String(e.id)) ?? [],
  }));
}

/** Next journal number, so the form can show it before saving. */
export async function peekNextJournalNo(): Promise<number> {
  const db = getSupabase();
  if (!db) return 1001;
  const { data } = await db
    .from("journal_entry")
    .select("journal_no")
    .eq("business_id", biz)
    .order("journal_no", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.journal_no ? Number(data.journal_no) : 1000) + 1;
}

export interface PersonOption {
  id: string;
  name: string;
}
export async function getPeople(): Promise<PersonOption[]> {
  const db = getSupabase();
  if (!db) return [];
  const { data } = await db.from("app_user").select("id,full_name").eq("business_id", biz).order("full_name");
  return (data ?? []).map((u) => ({ id: String(u.id), name: String(u.full_name) }));
}
