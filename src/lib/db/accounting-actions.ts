"use server";

/**
 * Bookkeeping server actions: carry routine entries to the ledger, record a
 * classified expense, and review/approve the period close. The rules propose;
 * the deterministic engine builds every balanced double-entry; the database
 * validates it at commit. Every automated action is written to the audit log.
 */
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabase, DEMO_BUSINESS_ID } from "@/lib/supabase/client";
import { getBookkeeper } from "@/lib/bookkeeping/rules";
import { getAccountingOverview, currentPeriodName, currentPeriodBounds } from "@/lib/db/accounting";

const biz = DEMO_BUSINESS_ID;
const WASTE_TYPES = ["waste", "spoilage", "expired"];
type Result = { ok: boolean; error?: string };

function db(): SupabaseClient {
  const c = getSupabase();
  if (!c) throw new Error("Database is not configured");
  return c;
}
const round = (n: number) => Math.round(n);

async function accountMap(c: SupabaseClient): Promise<Map<string, string>> {
  const { data } = await c.from("gl_account").select("id,code").eq("business_id", biz);
  const m = new Map<string, string>();
  for (const a of data ?? []) m.set(String(a.code), String(a.id));
  return m;
}

interface DraftLine {
  code: string;
  debit: number;
  credit: number;
}

/** Post a balanced journal entry. Lines are inserted as ONE array (one
 * transaction) so the deferred balance-check trigger passes at commit. */
async function postJournal(
  c: SupabaseClient,
  accts: Map<string, string>,
  opts: { description: string; referenceType?: string; referenceId?: string; periodId?: string | null; lines: DraftLine[] },
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const debit = opts.lines.reduce((s, l) => s + l.debit, 0);
  const credit = opts.lines.reduce((s, l) => s + l.credit, 0);
  if (round(debit) !== round(credit)) return { ok: false, error: "internal: unbalanced draft" };
  for (const l of opts.lines) if (!accts.has(l.code)) return { ok: false, error: `missing account ${l.code}` };

  const jeR = await c
    .from("journal_entry")
    .insert({
      business_id: biz,
      description: opts.description,
      reference_type: opts.referenceType ?? null,
      reference_id: opts.referenceId ?? null,
      period_id: opts.periodId ?? null,
    })
    .select("id")
    .single();
  if (jeR.error) return { ok: false, error: jeR.error.message };
  const entryId = String(jeR.data.id);

  const rows = opts.lines
    .filter((l) => l.debit > 0 || l.credit > 0)
    .map((l) => ({ journal_entry_id: entryId, account_id: accts.get(l.code)!, debit: round(l.debit), credit: round(l.credit) }));
  const lnR = await c.from("journal_line").insert(rows);
  if (lnR.error) return { ok: false, error: lnR.error.message };
  return { ok: true, id: entryId };
}

/** Find the current month's period; create it (open) if missing. */
async function currentPeriod(c: SupabaseClient): Promise<{ id: string; status: string } | null> {
  const name = currentPeriodName();
  const found = await c.from("accounting_period").select("id,status").eq("business_id", biz).eq("name", name).maybeSingle();
  if (found.data) return { id: String(found.data.id), status: String(found.data.status) };
  const { starts, ends } = currentPeriodBounds();
  const ins = await c
    .from("accounting_period")
    .insert({ business_id: biz, name, starts_on: starts, ends_on: ends, status: "open" })
    .select("id,status")
    .single();
  if (ins.error) return null;
  return { id: String(ins.data.id), status: String(ins.data.status) };
}

/** Record an automated action so the books stay auditable. */
async function logAction(
  c: SupabaseClient,
  action: string,
  payload: unknown,
  response: unknown,
): Promise<void> {
  const bk = getBookkeeper();
  try {
    await c.from("ai_interaction_log").insert({
      business_id: biz,
      provider: bk.providerName,
      model: "rules-v1",
      prompt: { action, ...(payload as object) },
      response: response as object,
      approved: true,
    });
  } catch {
    /* audit log is best-effort */
  }
}

// ---------------------------------------------------------------------------
// 1. Live expense-category preview (no write) — for the form as the user types.
// ---------------------------------------------------------------------------
export async function previewExpenseCategoryAction(description: string, amount: number) {
  return getBookkeeper().categorizeExpense(description, amount);
}

// ---------------------------------------------------------------------------
// 2. Record an expense: AI categorizes → post Dr <category> / Cr Cash.
// ---------------------------------------------------------------------------
export async function recordExpenseAction(input: {
  description: string;
  amount: number;
}): Promise<Result & { accountCode?: string; accountName?: string; explanation?: string }> {
  try {
    const c = db();
    const amount = Number(input.amount);
    if (!amount || amount <= 0) return { ok: false, error: "Enter an amount greater than zero" };
    const period = await currentPeriod(c);
    if (period && period.status === "locked") return { ok: false, error: `Period ${currentPeriodName()} is locked` };

    const cat = await getBookkeeper().categorizeExpense(input.description, amount);
    const accts = await accountMap(c);

    // Journal first (so the expense row can carry journal_entry_id — no UPDATE needed).
    const je = await postJournal(c, accts, {
      description: `Expense: ${input.description || cat.accountName}`,
      referenceType: "expense",
      periodId: period?.id ?? null,
      lines: [
        { code: cat.accountCode, debit: amount, credit: 0 },
        { code: "1000", debit: 0, credit: amount },
      ],
    });
    if (!je.ok) return { ok: false, error: je.error };

    const exp = await c.from("expense").insert({
      business_id: biz,
      amount: round(amount),
      description: input.description || null,
      journal_entry_id: je.id,
    });
    if (exp.error) return { ok: false, error: exp.error.message };

    await logAction(c, "categorize_expense", { description: input.description, amount }, cat);
    revalidatePath("/accounting");
    revalidatePath("/dashboard");
    return { ok: true, accountCode: cat.accountCode, accountName: cat.accountName, explanation: cat.explanation };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ---------------------------------------------------------------------------
// 3. Auto-post routine journals for purchases and waste that aren't journaled.
// ---------------------------------------------------------------------------
export async function autoPostPendingAction(): Promise<
  Result & { purchases?: number; waste?: number; details?: string[] }
> {
  try {
    const c = db();
    const period = await currentPeriod(c);
    if (period && period.status === "locked") return { ok: false, error: `Period ${currentPeriodName()} is locked` };
    const accts = await accountMap(c);

    const [receiptsR, movesR, entriesR, wasteMovesR, boardR] = await Promise.all([
      c.from("goods_receipt").select("id,received_at,note").eq("business_id", biz),
      c.from("inventory_movement").select("value,reference_type,reference_id").eq("business_id", biz).eq("type", "purchase_receipt"),
      c.from("journal_entry").select("reference_type,reference_id").eq("business_id", biz),
      c.from("inventory_movement").select("id,item_id,value,base_quantity_signed,type").eq("business_id", biz).in("type", WASTE_TYPES),
      c.from("stock_board").select("item_id,unit_cost").eq("business_id", biz),
    ]);

    const journaled = new Set(
      (entriesR.data ?? []).filter((e) => e.reference_id).map((e) => `${e.reference_type}:${e.reference_id}`),
    );
    // Inventory value received per goods_receipt (sum of its purchase_receipt movement values).
    const receiptValue = new Map<string, number>();
    for (const m of movesR.data ?? []) {
      if (m.reference_type === "goods_receipt" && m.reference_id) {
        receiptValue.set(String(m.reference_id), (receiptValue.get(String(m.reference_id)) ?? 0) + Number(m.value ?? 0));
      }
    }
    const wac = new Map<string, number>();
    for (const b of boardR.data ?? []) wac.set(String(b.item_id), Number(b.unit_cost ?? 0));

    const details: string[] = [];
    let purchases = 0;
    let waste = 0;

    for (const r of receiptsR.data ?? []) {
      const id = String(r.id);
      if (journaled.has(`goods_receipt:${id}`)) continue;
      const value = round(receiptValue.get(id) ?? 0);
      if (value <= 0) continue;
      const je = await postJournal(c, accts, {
        description: `Purchase received${r.note ? ` — ${r.note}` : ""}`,
        referenceType: "goods_receipt",
        referenceId: id,
        periodId: period?.id ?? null,
        lines: [
          { code: "1200", debit: value, credit: 0 }, // Inventory
          { code: "2000", debit: 0, credit: value }, // Accounts payable
        ],
      });
      if (je.ok) {
        purchases += 1;
        details.push(`Purchase ${id.slice(0, 8)}: Dr Inventory / Cr A/P ${value.toLocaleString()} IQD`);
      }
    }

    for (const m of wasteMovesR.data ?? []) {
      const id = String(m.id);
      if (journaled.has(`inventory_movement:${id}`)) continue;
      const qty = Math.abs(Number(m.base_quantity_signed ?? 0));
      const value = round(Number(m.value ?? 0) || qty * (wac.get(String(m.item_id)) ?? 0));
      if (value <= 0) continue;
      const je = await postJournal(c, accts, {
        description: "Waste / spoilage write-off",
        referenceType: "inventory_movement",
        referenceId: id,
        periodId: period?.id ?? null,
        lines: [
          { code: "5300", debit: value, credit: 0 }, // Waste & spoilage
          { code: "1200", debit: 0, credit: value }, // Inventory
        ],
      });
      if (je.ok) {
        waste += 1;
        details.push(`Waste ${id.slice(0, 8)}: Dr Waste / Cr Inventory ${value.toLocaleString()} IQD`);
      }
    }

    await logAction(c, "auto_post", {}, { purchases, waste });
    revalidatePath("/accounting");
    revalidatePath("/dashboard");
    return { ok: true, purchases, waste, details };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ---------------------------------------------------------------------------
// 4. Propose the month-end close (read-only review by the accountant).
// ---------------------------------------------------------------------------
export async function proposeCloseAction() {
  const overview = await getAccountingOverview();
  if (!overview) return { ok: false as const, error: "Database not configured" };
  const review = await getBookkeeper().reviewClose({
    periodName: overview.currentPeriodName,
    revenue: overview.revenue,
    cogs: overview.cogs,
    otherExpenses: overview.otherExpenses,
    waste: overview.waste,
    netProfit: overview.netProfit,
    unpostedPurchases: overview.unpostedPurchases,
    unpostedWaste: overview.unpostedWaste,
    trialBalanced: overview.trialBalanced,
  });
  try {
    const c = db();
    await logAction(c, "propose_close", { period: overview.currentPeriodName }, review);
  } catch {
    /* ignore */
  }
  return { ok: true as const, overview, review };
}

// ---------------------------------------------------------------------------
// 5. Human approves the close → lock the period (finalize).
// ---------------------------------------------------------------------------
export async function approveCloseAction(): Promise<Result & { periodName?: string }> {
  try {
    const c = db();
    const period = await currentPeriod(c);
    if (!period) return { ok: false, error: "Could not open the current period" };
    const name = currentPeriodName();
    if (period.status === "locked") return { ok: true, periodName: name };

    const upd = await c
      .from("accounting_period")
      .update({ status: "locked", locked_at: new Date().toISOString() })
      .eq("id", period.id);
    if (upd.error) return { ok: false, error: upd.error.message };

    await logAction(c, "approve_close", { period: name }, { locked: true });
    revalidatePath("/accounting");
    return { ok: true, periodName: name };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
