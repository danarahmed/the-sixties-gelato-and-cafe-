"use server";
/**
 * Expenses, manual journals and closing the period. Journals are numbered by
 * the database when they are published, drafts never reach the books, a
 * published journal is corrected only by reversing it, and a period locks
 * only when every closing check passes (audit C-02, H-02, H-08, M-09).
 */
import { z } from "zod";
import { getBookkeeper, type ExpenseCategorization } from "@/lib/bookkeeping/rules";
import { callRpc, parse, refresh, type ActionResult } from "@/lib/db/rpc";
import { day, id, nonNegative, optionalText, positive, text } from "@/lib/validation";

const BOOK_PATHS = ["/journals", "/accounting", "/reports", "/dashboard"];

/** The account the house rules propose for a narration. A proposal, never a posting. */
export async function previewExpenseCategoryAction(
  description: string,
  amount: number,
): Promise<ExpenseCategorization> {
  return getBookkeeper().categorizeExpense(
    String(description ?? "").slice(0, 300),
    Number(amount) || 0,
  );
}

const expenseInput = z.object({
  description: text("What the expense was for", 300),
  amount: positive("The amount"),
  accountCode: z.string().regex(/^\d{4}$/, "Choose the account"),
  paidFrom: z.enum(["cash", "card", "bank"], { message: "Choose how it was paid" }),
  date: day("The date"),
});

/** Dr the confirmed expense account / Cr where the money came from — one step. */
export async function recordExpenseAction(
  input: z.input<typeof expenseInput>,
): Promise<ActionResult<{ journalNo: number | null }>> {
  const v = parse(expenseInput, input);
  if (!v.ok) return v;
  const r = await callRpc<Record<string, unknown>>("record_expense", {
    p_description: v.data.description,
    p_amount: v.data.amount,
    p_account_code: v.data.accountCode,
    p_paid_from: v.data.paidFrom,
    p_date: v.data.date,
  });
  if (!r.ok) return r;
  refresh("/expenses", ...BOOK_PATHS);
  return {
    ok: true,
    data: { journalNo: r.data.journal_no == null ? null : Number(r.data.journal_no) },
  };
}

const journalInput = z.object({
  date: day("The date"),
  description: text("Notes", 500),
  referenceNo: optionalText(60),
  reverseOn: day("The reversal date").nullable(),
  publish: z.boolean(),
  lines: z
    .array(
      z.object({
        code: z.string().regex(/^\d{4}$/, "Choose an account on every line"),
        memo: optionalText(200),
        debit: nonNegative("Debit"),
        credit: nonNegative("Credit"),
      }),
    )
    .min(1, "Add at least one line"),
});

export async function saveJournalAction(
  input: z.input<typeof journalInput>,
): Promise<ActionResult<{ status: string; journalNo: number | null; reversalNo: number | null }>> {
  const v = parse(journalInput, input);
  if (!v.ok) return v;
  const lines = v.data.lines.filter((l) => Number(l.debit) > 0 || Number(l.credit) > 0);
  if (lines.some((l) => Number(l.debit) > 0 && Number(l.credit) > 0)) {
    return { ok: false, error: "A line is either a debit or a credit, not both" };
  }
  const r = await callRpc<Record<string, unknown>>("save_journal", {
    p_date: v.data.date,
    p_description: v.data.description,
    p_lines: lines.map((l) => ({
      code: l.code,
      debit: l.debit,
      credit: l.credit,
      memo: l.memo ?? "",
    })),
    p_publish: v.data.publish,
    p_reference_no: v.data.referenceNo,
    p_reverse_on: v.data.reverseOn,
  });
  if (!r.ok) return r;
  refresh(...BOOK_PATHS);
  return {
    ok: true,
    data: {
      status: String(r.data.status),
      journalNo: r.data.journal_no == null ? null : Number(r.data.journal_no),
      reversalNo: r.data.reversal_journal_no == null ? null : Number(r.data.reversal_journal_no),
    },
  };
}

const entryInput = z.object({ entryId: id("a journal") });

export async function publishJournalAction(
  input: z.input<typeof entryInput>,
): Promise<ActionResult<{ journalNo: number | null }>> {
  const v = parse(entryInput, input);
  if (!v.ok) return v;
  const r = await callRpc<Record<string, unknown>>("publish_journal", { p_entry: v.data.entryId });
  if (!r.ok) return r;
  refresh(...BOOK_PATHS);
  return {
    ok: true,
    data: { journalNo: r.data.journal_no == null ? null : Number(r.data.journal_no) },
  };
}

/** Only a draft can be discarded — and failure is reported, never passed off as done (M-09). */
export async function discardJournalAction(
  input: z.input<typeof entryInput>,
): Promise<ActionResult<null>> {
  const v = parse(entryInput, input);
  if (!v.ok) return v;
  const r = await callRpc("discard_journal", { p_entry: v.data.entryId });
  if (!r.ok) return r;
  refresh(...BOOK_PATHS);
  return { ok: true, data: null };
}

const reverseInput = z.object({
  entryId: id("a journal"),
  reason: text("A reason", 300),
  date: day("The date"),
});

/** The one way to correct a published journal: a mirror entry, dated when the correction is made. */
export async function reverseJournalAction(
  input: z.input<typeof reverseInput>,
): Promise<ActionResult<{ journalNo: number | null }>> {
  const v = parse(reverseInput, input);
  if (!v.ok) return v;
  const r = await callRpc<Record<string, unknown>>("reverse_journal", {
    p_entry: v.data.entryId,
    p_reason: v.data.reason,
    p_date: v.data.date,
  });
  if (!r.ok) return r;
  refresh(...BOOK_PATHS, "/vendors", "/expenses", "/sales");
  return {
    ok: true,
    data: { journalNo: r.data.journal_no == null ? null : Number(r.data.journal_no) },
  };
}

const lockInput = z.object({ periodId: id("a period"), reason: optionalText(300) });

/** Locks only if every closing check passes — the database re-runs them all as it locks. */
export async function lockPeriodAction(
  input: z.input<typeof lockInput>,
): Promise<ActionResult<{ period: string; yearEndJournalNo: number | null }>> {
  const v = parse(lockInput, input);
  if (!v.ok) return v;
  const r = await callRpc<Record<string, unknown>>("lock_period", {
    p_period: v.data.periodId,
    p_reason: v.data.reason,
  });
  if (!r.ok) return r;
  refresh(...BOOK_PATHS, "/journals", "/expenses");
  return {
    ok: true,
    data: {
      period: String(r.data.period ?? ""),
      yearEndJournalNo:
        r.data.year_end_journal_no == null ? null : Number(r.data.year_end_journal_no),
    },
  };
}

const unlockInput = z.object({ periodId: id("a period"), reason: text("A reason", 300) });

/** Exceptional: the owner only, with a reason that goes on the audit trail. */
export async function unlockPeriodAction(
  input: z.input<typeof unlockInput>,
): Promise<ActionResult<null>> {
  const v = parse(unlockInput, input);
  if (!v.ok) return v;
  const r = await callRpc("unlock_period", { p_period: v.data.periodId, p_reason: v.data.reason });
  if (!r.ok) return r;
  refresh(...BOOK_PATHS);
  return { ok: true, data: null };
}
