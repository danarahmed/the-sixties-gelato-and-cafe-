"use server";

/**
 * Bookkeeping write actions. Each one raises a balanced double entry through
 * the same helper, so the deferred balance-check trigger validates every
 * posting at commit. Nothing is ever edited in place — corrections are
 * reversing entries.
 */
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabase, DEMO_BUSINESS_ID } from "@/lib/supabase/client";
import { getDayTotals } from "@/lib/db/books";
import { currentPeriodName, currentPeriodBounds } from "@/lib/db/accounting";

const biz = DEMO_BUSINESS_ID;
type Result = { ok: boolean; error?: string; id?: string };

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

async function currentPeriod(c: SupabaseClient): Promise<{ id: string; status: string } | null> {
  const name = currentPeriodName();
  const found = await c
    .from("accounting_period")
    .select("id,status")
    .eq("business_id", biz)
    .eq("name", name)
    .maybeSingle();
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

interface DraftLine {
  code: string;
  debit: number;
  credit: number;
}

/** Post one balanced entry. Lines go in as a single array = one transaction. */
async function postJournal(
  c: SupabaseClient,
  accts: Map<string, string>,
  opts: {
    description: string;
    referenceType?: string;
    referenceId?: string;
    periodId?: string | null;
    lines: DraftLine[];
  },
): Promise<Result> {
  const debit = opts.lines.reduce((s, l) => s + l.debit, 0);
  const credit = opts.lines.reduce((s, l) => s + l.credit, 0);
  if (round(debit) !== round(credit)) {
    return { ok: false, error: `Entry does not balance: ${round(debit)} vs ${round(credit)}` };
  }
  for (const l of opts.lines) {
    if (!accts.has(l.code)) return { ok: false, error: `Account ${l.code} is missing` };
  }
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
    .map((l) => ({
      journal_entry_id: entryId,
      account_id: accts.get(l.code)!,
      debit: round(l.debit),
      credit: round(l.credit),
    }));
  const lnR = await c.from("journal_line").insert(rows);
  if (lnR.error) return { ok: false, error: lnR.error.message };
  return { ok: true, id: entryId };
}

async function guardOpenPeriod(c: SupabaseClient) {
  const period = await currentPeriod(c);
  if (period && period.status === "locked") {
    throw new Error(`Period ${currentPeriodName()} is locked — post a reversing entry instead`);
  }
  return period;
}

// ---------------------------------------------------------------------------
// Vendors: record a bill, pay a bill
// ---------------------------------------------------------------------------
export async function recordBillAction(input: {
  supplierId: string;
  invoiceNo: string;
  amount: number;
  invoiceDate: string;
  termDays: number;
}): Promise<Result> {
  try {
    const c = db();
    const amount = Number(input.amount);
    if (!input.supplierId) return { ok: false, error: "Choose a vendor" };
    if (!amount || amount <= 0) return { ok: false, error: "Enter an amount greater than zero" };
    const period = await guardOpenPeriod(c);
    const accts = await accountMap(c);

    const invoiceDate = input.invoiceDate || new Date().toISOString().slice(0, 10);
    const due = new Date(invoiceDate + "T00:00:00Z");
    due.setUTCDate(due.getUTCDate() + (Number(input.termDays) || 0));
    const dueDate = due.toISOString().slice(0, 10);

    // Dr Inventory / Cr Accounts payable — the stock arrives, the debt is owed.
    const je = await postJournal(c, accts, {
      description: `Bill ${input.invoiceNo || ""}`.trim() || "Vendor bill",
      referenceType: "purchase_invoice",
      periodId: period?.id ?? null,
      lines: [
        { code: "1200", debit: amount, credit: 0 },
        { code: "2000", debit: 0, credit: amount },
      ],
    });
    if (!je.ok) return je;

    const ins = await c
      .from("purchase_invoice")
      .insert({
        business_id: biz,
        supplier_id: input.supplierId,
        invoice_no: input.invoiceNo || null,
        invoice_date: invoiceDate,
        due_date: dueDate,
        amount_total: round(amount),
        paid_amount: 0,
        is_paid: false,
        journal_entry_id: je.id,
      })
      .select("id")
      .single();
    if (ins.error) return { ok: false, error: ins.error.message };

    revalidatePath("/vendors");
    revalidatePath("/journals");
    return { ok: true, id: String(ins.data.id) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function payBillAction(input: {
  billId: string;
  amount: number;
  method: string;
}): Promise<Result> {
  try {
    const c = db();
    const amount = Number(input.amount);
    if (!amount || amount <= 0) return { ok: false, error: "Enter an amount greater than zero" };
    const period = await guardOpenPeriod(c);
    const accts = await accountMap(c);

    const billR = await c
      .from("purchase_invoice")
      .select("id,supplier_id,invoice_no,amount_total,paid_amount")
      .eq("id", input.billId)
      .maybeSingle();
    if (billR.error || !billR.data) return { ok: false, error: "Bill not found" };
    const bill = billR.data;
    const outstanding = Number(bill.amount_total ?? 0) - Number(bill.paid_amount ?? 0);
    if (amount > outstanding + 0.5) {
      return { ok: false, error: `That is more than the ${round(outstanding).toLocaleString()} outstanding` };
    }

    // Dr Accounts payable / Cr Cash — the debt is settled.
    const creditCode = input.method === "card" ? "1010" : "1000";
    const je = await postJournal(c, accts, {
      description: `Payment — bill ${bill.invoice_no ?? ""}`.trim(),
      referenceType: "supplier_payment",
      periodId: period?.id ?? null,
      lines: [
        { code: "2000", debit: amount, credit: 0 },
        { code: creditCode, debit: 0, credit: amount },
      ],
    });
    if (!je.ok) return je;

    const payR = await c.from("supplier_payment").insert({
      business_id: biz,
      supplier_id: String(bill.supplier_id),
      purchase_invoice_id: String(bill.id),
      amount: round(amount),
      method: input.method,
      journal_entry_id: je.id,
    });
    if (payR.error) return { ok: false, error: payR.error.message };

    const newPaid = Number(bill.paid_amount ?? 0) + amount;
    await c
      .from("purchase_invoice")
      .update({ paid_amount: round(newPaid), is_paid: newPaid >= Number(bill.amount_total) - 0.5 })
      .eq("id", String(bill.id));

    revalidatePath("/vendors");
    revalidatePath("/journals");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ---------------------------------------------------------------------------
// Day close: count the till against what the POS says it took
// ---------------------------------------------------------------------------
export async function closeDayAction(input: {
  day: string;
  countedCash: number;
}): Promise<Result & { variance?: number; expected?: number }> {
  try {
    const c = db();
    const period = await guardOpenPeriod(c);
    const accts = await accountMap(c);

    const totals = await getDayTotals(input.day);
    if (totals.orders === 0) return { ok: false, error: "No sales recorded for that day" };

    const expected = round(totals.cash);
    const counted = round(Number(input.countedCash) || 0);
    const variance = counted - expected; // + over, − short

    const shiftR = await c
      .from("work_shift")
      .insert({
        business_id: biz,
        location_id: (
          await c.from("location").select("id").eq("business_id", biz).limit(1).maybeSingle()
        ).data?.id,
        opened_at: `${input.day}T06:00:00Z`,
        closed_at: new Date().toISOString(),
        opening_float: 0,
        expected_cash: expected,
        counted_cash: counted,
        variance,
      })
      .select("id")
      .single();
    if (shiftR.error) return { ok: false, error: shiftR.error.message };

    // Only post when there is a difference worth recording.
    if (Math.abs(variance) >= 1) {
      const je = await postJournal(c, accts, {
        description: `Cash over/short — ${input.day}`,
        referenceType: "work_shift",
        referenceId: String(shiftR.data.id),
        periodId: period?.id ?? null,
        lines:
          variance < 0
            ? [
                { code: "6300", debit: Math.abs(variance), credit: 0 }, // short = expense
                { code: "1000", debit: 0, credit: Math.abs(variance) },
              ]
            : [
                { code: "1000", debit: variance, credit: 0 }, // over = more cash than expected
                { code: "6300", debit: 0, credit: variance },
              ],
      });
      if (!je.ok) return je;
    }

    revalidatePath("/sales");
    revalidatePath("/journals");
    return { ok: true, variance, expected };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ---------------------------------------------------------------------------
// Manual journal — many lines, saved as a draft or published to the books
// ---------------------------------------------------------------------------
export interface JournalLineInput {
  accountCode: string;
  description?: string;
  debit: number;
  credit: number;
}

export interface SaveJournalInput {
  date: string;
  referenceNo?: string;
  notes: string;
  postedBy?: string | null;
  reverseOn?: string | null;
  publish: boolean;
  lines: JournalLineInput[];
}

export async function saveJournalAction(
  input: SaveJournalInput,
): Promise<Result & { journalNo?: number; status?: string }> {
  try {
    const c = db();
    const lines = (input.lines ?? []).filter(
      (l) => l.accountCode && (Number(l.debit) > 0 || Number(l.credit) > 0),
    );
    if (lines.length === 0) return { ok: false, error: "Add at least one line with an amount" };
    if (!input.notes?.trim()) return { ok: false, error: "Notes are required" };

    const debit = lines.reduce((s2, l) => s2 + (Number(l.debit) || 0), 0);
    const credit = lines.reduce((s2, l) => s2 + (Number(l.credit) || 0), 0);
    if (input.publish && round(debit) !== round(credit)) {
      return {
        ok: false,
        error: `Cannot publish — the difference is ${Math.abs(round(debit) - round(credit)).toLocaleString()} IQD`,
      };
    }

    const period = await guardOpenPeriod(c);
    const accts = await accountMap(c);
    for (const l of lines) {
      if (!accts.has(l.accountCode)) return { ok: false, error: `Account ${l.accountCode} is missing` };
    }

    const occurredAt = input.date
      ? new Date(`${input.date}T12:00:00Z`).toISOString()
      : new Date().toISOString();
    const journalNo = await nextJournalNo(c);

    const jeR = await c
      .from("journal_entry")
      .insert({
        business_id: biz,
        journal_no: journalNo,
        description: input.notes.trim(),
        reference_no: input.referenceNo?.trim() || null,
        reference_type: "manual",
        status: input.publish ? "published" : "draft",
        reverse_on: input.reverseOn || null,
        period_id: period?.id ?? null,
        posted_by: input.postedBy || null,
        occurred_at: occurredAt,
      })
      .select("id")
      .single();
    if (jeR.error) return { ok: false, error: jeR.error.message };
    const entryId = String(jeR.data.id);

    const lnR = await c.from("journal_line").insert(
      lines.map((l) => ({
        journal_entry_id: entryId,
        account_id: accts.get(l.accountCode)!,
        debit: round(Number(l.debit) || 0),
        credit: round(Number(l.credit) || 0),
        memo: l.description?.trim() || null,
      })),
    );
    if (lnR.error) return { ok: false, error: lnR.error.message };

    // A reversal date books the mirror entry straight away, dated then.
    if (input.publish && input.reverseOn) {
      const revNo = await nextJournalNo(c);
      const revR = await c
        .from("journal_entry")
        .insert({
          business_id: biz,
          journal_no: revNo,
          description: `Reversal of ${journalNo} — ${input.notes.trim()}`,
          reference_no: input.referenceNo?.trim() || null,
          reference_type: "manual",
          status: "published",
          reverses_entry: entryId,
          posted_by: input.postedBy || null,
          occurred_at: new Date(`${input.reverseOn}T12:00:00Z`).toISOString(),
        })
        .select("id")
        .single();
      if (!revR.error) {
        await c.from("journal_line").insert(
          lines.map((l) => ({
            journal_entry_id: String(revR.data.id),
            account_id: accts.get(l.accountCode)!,
            debit: round(Number(l.credit) || 0),
            credit: round(Number(l.debit) || 0),
            memo: l.description?.trim() || null,
          })),
        );
      }
    }

    revalidatePath("/journals");
    revalidatePath("/accounting");
    return { ok: true, id: entryId, journalNo, status: input.publish ? "published" : "draft" };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Publish a draft. The database re-checks the balance as it commits. */
export async function publishJournalAction(entryId: string): Promise<Result> {
  try {
    const c = db();
    const { error } = await c
      .from("journal_entry")
      .update({ status: "published" })
      .eq("id", entryId)
      .eq("business_id", biz);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/journals");
    revalidatePath("/accounting");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Discard a draft. Only ever a draft — published entries are permanent. */
export async function discardDraftAction(entryId: string): Promise<Result> {
  try {
    const c = db();
    await c.from("journal_line").delete().eq("journal_entry_id", entryId);
    const { error } = await c
      .from("journal_entry")
      .delete()
      .eq("id", entryId)
      .eq("business_id", biz)
      .eq("status", "draft");
    if (error) return { ok: false, error: error.message };
    revalidatePath("/journals");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Next number in the register. */
async function nextJournalNo(c: SupabaseClient): Promise<number> {
  const { data } = await c
    .from("journal_entry")
    .select("journal_no")
    .eq("business_id", biz)
    .order("journal_no", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.journal_no ? Number(data.journal_no) : 1000) + 1;
}
