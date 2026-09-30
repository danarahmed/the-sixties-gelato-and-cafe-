"use server";
/**
 * Expenses, manual journals and closing the period. Journals are numbered by
 * the database when they are published, drafts never reach the books, a
 * published journal is corrected only by reversing it, and a period locks
 * only when every closing check passes (audit C-02, H-02, H-08, M-09).
 */
import { z } from "zod";
import { getBookkeeper, type ExpenseCategorization } from "@/lib/bookkeeping/rules";
import { badKey, callRpc, parse, refresh, type ActionResult } from "@/lib/db/rpc";
import {
  day,
  id,
  nonNegative,
  optionalText,
  paymentSource,
  positive,
  text,
} from "@/lib/validation";
import { placeForWrite, tillForWrite } from "@/lib/place";
import { getSession } from "@/lib/auth/session";
import { businessToday } from "@/lib/dates";
import { getExpenses, getPrepaidExpenses } from "@/lib/db/books";
import {
  postedPayments,
  SAME_PAYMENT,
  samePayments,
  type PostedPayment,
  type SamePaymentRefusal,
} from "@/lib/expenses";

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

/**
 * The payments posted like this one (P2-14): an expense to the same account,
 * for the same amount, within three days. The screen asks as it is typed; this
 * is for one posted elsewhere since the screen was opened. What cannot be read
 * asks nothing: the question is a help, the books do not depend on it.
 */
async function sameAsPosted(p: {
  accountCode: string;
  amount: string | number;
  date?: string;
}): Promise<PostedPayment[]> {
  const timezone = (await getSession()).profile?.timezone;
  if (!timezone) return [];
  const [expenses, prepaid] = await Promise.all([
    getExpenses(100).catch(() => []),
    getPrepaidExpenses().catch(() => []),
  ]);
  return samePayments(postedPayments(expenses, prepaid, timezone), {
    accountCode: p.accountCode,
    amount: Number(p.amount),
    date: p.date ?? businessToday(timezone),
  });
}

const expenseInput = z.object({
  description: text("What the expense was for", 300),
  amount: positive("The amount"),
  accountCode: z.string().regex(/^\d{4}$/, "Choose the account"),
  paidFrom: paymentSource,
  date: day("The date"),
  /** Posted although one like it is posted already: the person said it is another. */
  acceptSame: z.boolean().default(false),
});

/**
 * Dr the confirmed expense account / Cr where the money came from — one step.
 * One like it posted already is asked about first (P2-14), unless the person
 * said it is another payment, or this is a re-send of one that may be saved
 * (its key's first answer is given back instead).
 */
export async function recordExpenseAction(
  input: z.input<typeof expenseInput>,
  key: string,
  resend = false,
): Promise<ActionResult<{ journalNo: number | null }> | SamePaymentRefusal> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(expenseInput, input);
  if (!v.ok) return v;
  if (!v.data.acceptSame && !resend) {
    const same = await sameAsPosted(v.data);
    if (same.length > 0) return { ok: false, error: SAME_PAYMENT, same };
  }
  const r = await callRpc<Record<string, unknown>>("record_expense", {
    p_description: v.data.description,
    p_amount: v.data.amount,
    p_account_code: v.data.accountCode,
    p_paid_from: v.data.paidFrom,
    p_date: v.data.date,
    // Paid from the till: that till's branch; else where this device works (0055).
    p_location: v.data.paidFrom === "till" ? await tillForWrite() : await placeForWrite(),
    p_idempotency_key: key,
  });
  if (!r.ok) return r;
  refresh("/expenses", "/sales", ...BOOK_PATHS);
  return {
    ok: true,
    data: { journalNo: r.data.journal_no == null ? null : Number(r.data.journal_no) },
  };
}

const prepaidInput = z.object({
  description: text("What the expense was for", 300),
  amount: positive("The amount"),
  accountCode: z.string().regex(/^\d{4}$/, "Choose the account"),
  paidFrom: paymentSource,
  firstMonth: z.string().regex(/^\d{4}-\d{2}$/, "Choose the first month it covers"),
  months: z.coerce
    .number()
    .int("Say how many months it covers, 1 to 36")
    .min(1, "Say how many months it covers, 1 to 36")
    .max(36, "Say how many months it covers, 1 to 36"),
  /** Paid although one like it is posted already: the person said it is another. */
  acceptSame: z.boolean().default(false),
});

/**
 * Paid ahead for months to come (0060): Dr 1400 Prepaid expenses / Cr where
 * the money came from; each month it covers takes its share as an expense of
 * that month, the month it starts in at once if that has come.
 */
export async function recordPrepaidExpenseAction(
  input: z.input<typeof prepaidInput>,
  key: string,
  resend = false,
): Promise<ActionResult<{ journalNo: number | null; released: number }> | SamePaymentRefusal> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(prepaidInput, input);
  if (!v.ok) return v;
  // Paid today: one like it paid within three days is asked about first (P2-14).
  if (!v.data.acceptSame && !resend) {
    const same = await sameAsPosted(v.data);
    if (same.length > 0) return { ok: false, error: SAME_PAYMENT, same };
  }
  const r = await callRpc<Record<string, unknown>>("record_prepaid_expense", {
    p_description: v.data.description,
    p_amount: v.data.amount,
    p_account_code: v.data.accountCode,
    p_paid_from: v.data.paidFrom,
    p_first_month: `${v.data.firstMonth}-01`,
    p_months: v.data.months,
    // As an expense: paid from the till, that till's branch; else where this device works.
    p_location: v.data.paidFrom === "till" ? await tillForWrite() : await placeForWrite(),
    p_idempotency_key: key,
  });
  if (!r.ok) return r;
  refresh("/expenses", "/sales", ...BOOK_PATHS);
  return {
    ok: true,
    data: {
      journalNo: r.data.journal_no == null ? null : Number(r.data.journal_no),
      released: Array.isArray(r.data.released) ? r.data.released.length : 0,
    },
  };
}

/** Every share of the prepaid expenses whose month has come, posted (0060). */
export async function releasePrepaidAction(
  key: string,
): Promise<ActionResult<{ released: number }>> {
  const bad = badKey(key);
  if (bad) return bad;
  const r = await callRpc<Record<string, unknown>>("release_prepaid", { p_idempotency_key: key });
  if (!r.ok) return r;
  refresh("/expenses", ...BOOK_PATHS);
  return {
    ok: true,
    data: { released: Array.isArray(r.data.released) ? r.data.released.length : 0 },
  };
}

const cancelPrepaidInput = z.object({
  prepaidId: id("the prepaid expense"),
  reason: text("Why it is cancelled", 300),
});

/** One entered in error: its payment and every share posted reversed today (0060). */
export async function cancelPrepaidExpenseAction(
  input: z.input<typeof cancelPrepaidInput>,
  key: string,
): Promise<ActionResult<{ journalNo: number | null; sharesReversed: number }>> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(cancelPrepaidInput, input);
  if (!v.ok) return v;
  const r = await callRpc<Record<string, unknown>>("cancel_prepaid_expense", {
    p_prepaid: v.data.prepaidId,
    p_reason: v.data.reason,
    p_idempotency_key: key,
  });
  if (!r.ok) return r;
  refresh("/expenses", "/sales", ...BOOK_PATHS);
  return {
    ok: true,
    data: {
      journalNo: r.data.journal_no == null ? null : Number(r.data.journal_no),
      sharesReversed: Number(r.data.shares_reversed ?? 0),
    },
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
  key: string,
): Promise<ActionResult<{ status: string; journalNo: number | null; reversalNo: number | null }>> {
  const bad = badKey(key);
  if (bad) return bad;
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
    p_idempotency_key: key,
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
  key: string,
): Promise<ActionResult<{ journalNo: number | null }>> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(entryInput, input);
  if (!v.ok) return v;
  const r = await callRpc<Record<string, unknown>>("publish_journal", {
    p_entry: v.data.entryId,
    p_idempotency_key: key,
  });
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
  key: string,
): Promise<ActionResult<null>> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(entryInput, input);
  if (!v.ok) return v;
  const r = await callRpc("discard_journal", { p_entry: v.data.entryId, p_idempotency_key: key });
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
  key: string,
): Promise<ActionResult<{ journalNo: number | null }>> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(reverseInput, input);
  if (!v.ok) return v;
  const r = await callRpc<Record<string, unknown>>("reverse_journal", {
    p_entry: v.data.entryId,
    p_reason: v.data.reason,
    p_date: v.data.date,
    p_idempotency_key: key,
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
  key: string,
): Promise<ActionResult<{ period: string; yearEndJournalNo: number | null }>> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(lockInput, input);
  if (!v.ok) return v;
  const r = await callRpc<Record<string, unknown>>("lock_period", {
    p_period: v.data.periodId,
    p_reason: v.data.reason,
    p_idempotency_key: key,
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
  key: string,
): Promise<ActionResult<null>> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(unlockInput, input);
  if (!v.ok) return v;
  const r = await callRpc("unlock_period", {
    p_period: v.data.periodId,
    p_reason: v.data.reason,
    p_idempotency_key: key,
  });
  if (!r.ok) return r;
  refresh(...BOOK_PATHS);
  return { ok: true, data: null };
}

const correctionInput = z.object({
  date: day("The date"),
  description: text("Notes", 500),
  reason: text("The reason for correcting a control account", 500),
  lines: z
    .array(
      z.object({
        code: z.string().regex(/^\d{4}$/, "Choose an account on every line"),
        memo: optionalText(200),
        debit: nonNegative("Debit"),
        credit: nonNegative("Credit"),
      }),
    )
    .min(2, "A correction needs at least two lines"),
});

const legacyInput = z.object({ reason: text("A reason", 300) });

/**
 * Post the journals the old app never wrote for stock it moved — opening
 * stock, deliveries, count variances, waste — exactly as the new app posts
 * the same records. The owner's decision, once the records are reviewed.
 */
export async function postLegacyUnpostedAction(
  input: z.input<typeof legacyInput>,
  key: string,
): Promise<ActionResult<{ posted: number; total: number }>> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(legacyInput, input);
  if (!v.ok) return v;
  const r = await callRpc<Record<string, unknown>>("post_legacy_unposted", {
    p_reason: v.data.reason,
    p_idempotency_key: key,
  });
  if (!r.ok) return r;
  refresh(...BOOK_PATHS, "/inventory", "/vendors", "/purchasing");
  return {
    ok: true,
    data: { posted: Number(r.data.posted ?? 0), total: Number(r.data.total ?? 0) },
  };
}

/**
 * The owner's correction to a control account (Inventory, payables, goods
 * received, retained earnings), with the reason on the audit trail — for
 * repairing history recorded before the controls (docs/REMEDIATION.md).
 */
export async function postControlCorrectionAction(
  input: z.input<typeof correctionInput>,
  key: string,
): Promise<ActionResult<{ journalNo: number | null }>> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(correctionInput, input);
  if (!v.ok) return v;
  const lines = v.data.lines.filter((l) => Number(l.debit) > 0 || Number(l.credit) > 0);
  const r = await callRpc<Record<string, unknown>>("post_control_correction", {
    p_date: v.data.date,
    p_description: v.data.description,
    p_lines: lines.map((l) => ({
      code: l.code,
      debit: l.debit,
      credit: l.credit,
      memo: l.memo ?? "",
    })),
    p_reason: v.data.reason,
    p_idempotency_key: key,
  });
  if (!r.ok) return r;
  refresh(...BOOK_PATHS, "/inventory", "/vendors");
  return {
    ok: true,
    data: { journalNo: r.data.journal_no == null ? null : Number(r.data.journal_no) },
  };
}

// ---------------------------------------------------------------------------
// The chart of accounts (0058): an income or a cost added, renamed, taken out
// of use or brought back. The accounts the system posts to stay as they are.
// ---------------------------------------------------------------------------
const CHART_PATHS = ["/accounting", "/expenses", "/journals", "/reports", "/settings/languages"];

/** Its names in Arabic and Kurdish, as the café's own words for its name: only those given. */
const otherNames = (ar?: string | null, ckb?: string | null) => ({
  ...(ar ? { ar } : {}),
  ...(ckb ? { ckb } : {}),
});

const accountInput = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{4}$/, "An account's code is four digits"),
  name: text("The account's name", 60),
  type: z.enum(["revenue", "expense"], { message: "Choose an income or a cost" }),
  nameAr: optionalText(60),
  nameCkb: optionalText(60),
});

export async function createAccountAction(
  input: z.input<typeof accountInput>,
  key: string,
): Promise<ActionResult<{ code: string; name: string }>> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(accountInput, input);
  if (!v.ok) return v;
  const r = await callRpc<Record<string, unknown>>("create_account", {
    p_code: v.data.code,
    p_name: v.data.name,
    p_type: v.data.type,
    p_names: otherNames(v.data.nameAr, v.data.nameCkb),
    p_idempotency_key: key,
  });
  if (!r.ok) return r;
  refresh(...CHART_PATHS);
  return { ok: true, data: { code: String(r.data.code), name: String(r.data.name) } };
}

const renameInput = z.object({
  code: z.string().regex(/^\d{4}$/, "Choose the account"),
  name: text("The account's name", 60),
  nameAr: optionalText(60),
  nameCkb: optionalText(60),
});

export async function renameAccountAction(
  input: z.input<typeof renameInput>,
  key: string,
): Promise<ActionResult<{ code: string; name: string }>> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(renameInput, input);
  if (!v.ok) return v;
  const r = await callRpc<Record<string, unknown>>("rename_account", {
    p_code: v.data.code,
    p_name: v.data.name,
    p_names: otherNames(v.data.nameAr, v.data.nameCkb),
    p_idempotency_key: key,
  });
  if (!r.ok) return r;
  refresh(...CHART_PATHS);
  return { ok: true, data: { code: String(r.data.code), name: String(r.data.name) } };
}

const inUseInput = z.object({
  code: z.string().regex(/^\d{4}$/, "Choose the account"),
  inUse: z.boolean(),
  reason: text("Why", 300),
});

export async function setAccountInUseAction(
  input: z.input<typeof inUseInput>,
  key: string,
): Promise<ActionResult<{ code: string; inUse: boolean }>> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(inUseInput, input);
  if (!v.ok) return v;
  const r = await callRpc<Record<string, unknown>>("set_account_in_use", {
    p_code: v.data.code,
    p_in_use: v.data.inUse,
    p_reason: v.data.reason,
    p_idempotency_key: key,
  });
  if (!r.ok) return r;
  refresh(...CHART_PATHS);
  return { ok: true, data: { code: String(r.data.code), inUse: r.data.in_use === true } };
}
