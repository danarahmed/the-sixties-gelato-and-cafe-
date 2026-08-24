/**
 * Accounting reads used by the Accounting screen and the AI Accountant: period
 * totals, unposted-event counts, and the trial-balance check. Server-only; uses
 * the anon client scoped to the demo business by RLS.
 */
import { getSupabase, DEMO_BUSINESS_ID } from "@/lib/supabase/client";

const biz = DEMO_BUSINESS_ID;
const WASTE_TYPES = ["waste", "spoilage", "expired"];

export interface AccountingOverview {
  revenue: number;
  cogs: number;
  grossProfit: number;
  otherExpenses: number;
  waste: number;
  netProfit: number;
  unpostedPurchases: number;
  unpostedWaste: number;
  unpostedExpenses: number;
  trialDebit: number;
  trialCredit: number;
  trialBalanced: boolean;
  journalCount: number;
  currentPeriodName: string;
  currentPeriodStatus: string | null; // null = not created yet
}

/** Current month period name, e.g. "2026-08" (business runs Asia/Baghdad, but
 * month boundaries are coarse enough that server-local date is fine here). */
export function currentPeriodName(d = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
export function currentPeriodBounds(d = new Date()): { starts: string; ends: string } {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const starts = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
  const ends = new Date(Date.UTC(y, m + 1, 0)).toISOString().slice(0, 10);
  return { starts, ends };
}

export async function getAccountingOverview(): Promise<AccountingOverview | null> {
  const db = getSupabase();
  if (!db) return null;

  const [ordersR, expensesR, wasteR, linesR, entriesR, receiptsR, periodsR] = await Promise.all([
    db.from("sales_order").select("net_amount,cogs_amount,status").eq("business_id", biz),
    db.from("expense").select("amount,journal_entry_id").eq("business_id", biz),
    db.from("inventory_movement").select("id,value,type").eq("business_id", biz).in("type", WASTE_TYPES),
    db.from("journal_line").select("debit,credit"),
    db.from("journal_entry").select("id,reference_type,reference_id").eq("business_id", biz),
    db.from("goods_receipt").select("id").eq("business_id", biz),
    db.from("accounting_period").select("name,status").eq("business_id", biz),
  ]);

  const orders = ordersR.data ?? [];
  const revenue = orders.reduce((s, o) => s + Number(o.net_amount ?? 0), 0);
  const cogs = orders.reduce((s, o) => s + Number(o.cogs_amount ?? 0), 0);
  const expenses = expensesR.data ?? [];
  const otherExpenses = expenses.reduce((s, e) => s + Number(e.amount ?? 0), 0);
  const wasteRows = wasteR.data ?? [];
  const waste = wasteRows.reduce((s, w) => s + Math.abs(Number(w.value ?? 0)), 0);

  const entries = entriesR.data ?? [];
  const journaledRefs = new Set(
    entries.filter((e) => e.reference_id).map((e) => `${e.reference_type}:${e.reference_id}`),
  );
  const unpostedPurchases = (receiptsR.data ?? []).filter(
    (r) => !journaledRefs.has(`goods_receipt:${r.id}`),
  ).length;
  const unpostedWaste = wasteRows.filter(
    (w) => !journaledRefs.has(`inventory_movement:${w.id}`),
  ).length;
  const unpostedExpenses = expenses.filter((e) => !e.journal_entry_id).length;

  const lines = linesR.data ?? [];
  const trialDebit = lines.reduce((s, l) => s + Number(l.debit ?? 0), 0);
  const trialCredit = lines.reduce((s, l) => s + Number(l.credit ?? 0), 0);

  const pname = currentPeriodName();
  const period = (periodsR.data ?? []).find((p) => p.name === pname);

  return {
    revenue,
    cogs,
    grossProfit: revenue - cogs,
    otherExpenses,
    waste,
    netProfit: revenue - cogs - otherExpenses - waste,
    unpostedPurchases,
    unpostedWaste,
    unpostedExpenses,
    trialDebit,
    trialCredit,
    trialBalanced: Math.round(trialDebit) === Math.round(trialCredit),
    journalCount: entries.length,
    currentPeriodName: pname,
    currentPeriodStatus: period ? String(period.status) : null,
  };
}

export interface TrialBalanceRow {
  code: string;
  name: string;
  type: string;
  debit: number;
  credit: number;
}

/** Every account with its posted debits and credits — the proof the books tie. */
export async function getTrialBalance(): Promise<{
  rows: TrialBalanceRow[];
  totalDebit: number;
  totalCredit: number;
  balanced: boolean;
}> {
  const db = getSupabase();
  if (!db) return { rows: [], totalDebit: 0, totalCredit: 0, balanced: true };
  const [accR, lineR] = await Promise.all([
    db.from("gl_account").select("id,code,name,account_type").eq("business_id", biz).order("code"),
    db.from("journal_line").select("account_id,debit,credit"),
  ]);
  const sums = new Map<string, { debit: number; credit: number }>();
  for (const l of lineR.data ?? []) {
    const key = String(l.account_id);
    const cur = sums.get(key) ?? { debit: 0, credit: 0 };
    cur.debit += Number(l.debit ?? 0);
    cur.credit += Number(l.credit ?? 0);
    sums.set(key, cur);
  }
  const rows = (accR.data ?? []).map((a) => {
    const s = sums.get(String(a.id)) ?? { debit: 0, credit: 0 };
    return {
      code: String(a.code),
      name: String(a.name),
      type: String(a.account_type),
      debit: s.debit,
      credit: s.credit,
    };
  });
  const totalDebit = rows.reduce((s, r) => s + r.debit, 0);
  const totalCredit = rows.reduce((s, r) => s + r.credit, 0);
  return {
    rows,
    totalDebit,
    totalCredit,
    balanced: Math.round(totalDebit) === Math.round(totalCredit),
  };
}

export interface AiLogRow {
  id: string;
  provider: string;
  model: string;
  action: string;
  createdAt: string;
}

export async function getAiLog(limit = 20): Promise<AiLogRow[]> {
  const db = getSupabase();
  if (!db) return [];
  const { data, error } = await db
    .from("ai_interaction_log")
    .select("id,provider,model,prompt,created_at")
    .eq("business_id", biz)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []).map((r) => {
    const prompt = (r.prompt ?? {}) as { action?: string };
    return {
      id: String(r.id),
      provider: String(r.provider),
      model: String(r.model),
      action: prompt.action ? String(prompt.action) : "—",
      createdAt: String(r.created_at),
    };
  });
}
