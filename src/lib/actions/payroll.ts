"use server";
/**
 * Payroll, a month at a time, and advances (0049): drafted from the pay and
 * the hours, adjusted with why, approved once the month is over, reopened while
 * nothing is paid from it, and paid. The database posts every journal.
 */
import { z } from "zod";
import { badKey, callRpc, parse, refresh, type ActionResult } from "@/lib/db/rpc";
import { STAFF_PAID_FROM } from "@/lib/staff";
import {
  day,
  id,
  nonNegative,
  optionalNonNegative,
  optionalText,
  positive,
  text,
} from "@/lib/validation";
import { tillForWrite } from "@/lib/place";

const PAYROLL_PATHS = ["/payroll", "/staff", "/journals", "/reports", "/dashboard", "/sales"];

const paidFrom = z.enum(STAFF_PAID_FROM, {
  message: "Say where the money came from: the till, the safe, the bank or the owner",
});

/** A month's payroll drafted, or drafted again from the hours and the pay as they are now. */
export async function draftPayrollAction(
  input: { month: string },
  key: string,
): Promise<ActionResult<{ runId: string }>> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(z.object({ month: day("The month") }), input);
  if (!v.ok) return v;
  const r = await callRpc<Record<string, unknown>>("draft_payroll", {
    p_month: v.data.month,
    p_idempotency_key: key,
  });
  if (!r.ok) return r;
  refresh(...PAYROLL_PATHS);
  return { ok: true, data: { runId: String(r.data.run_id ?? "") } };
}

const adjustInput = z.object({
  lineId: id("a line of the payroll"),
  additions: nonNegative("Added"),
  additionsNote: optionalText(200),
  deductions: nonNegative("Deducted"),
  deductionsNote: optionalText(200),
  /** What is taken back of the advances; none: all that is owed, as far as the pay goes. */
  advanceRecovered: optionalNonNegative("Taken back of the advances"),
});

/** A draft's line: what is added and deducted, with why, and what is taken back of the advances. */
export async function adjustPayrollLineAction(
  input: z.input<typeof adjustInput>,
  key: string,
): Promise<ActionResult<{ net: number }>> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(adjustInput, input);
  if (!v.ok) return v;
  const r = await callRpc<Record<string, unknown>>("adjust_payroll_line", {
    p_line: v.data.lineId,
    p_additions: v.data.additions,
    p_additions_note: v.data.additionsNote,
    p_deductions: v.data.deductions,
    p_deductions_note: v.data.deductionsNote,
    p_advance_recovered: v.data.advanceRecovered,
    p_idempotency_key: key,
  });
  if (!r.ok) return r;
  refresh("/payroll");
  return { ok: true, data: { net: Number(r.data.net ?? 0) } };
}

const runInput = z.object({ runId: id("a payroll") });

/** A month's payroll approved: its journal on the month's last day. */
export async function approvePayrollAction(
  input: z.input<typeof runInput>,
  key: string,
): Promise<ActionResult<{ journalNo: number | null; status: string }>> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(runInput, input);
  if (!v.ok) return v;
  const r = await callRpc<Record<string, unknown>>("approve_payroll", {
    p_run: v.data.runId,
    p_idempotency_key: key,
  });
  if (!r.ok) return r;
  refresh(...PAYROLL_PATHS);
  return {
    ok: true,
    data: {
      journalNo: r.data.journal_no == null ? null : Number(r.data.journal_no),
      status: String(r.data.status ?? ""),
    },
  };
}

/** An approved payroll back to a draft, with why, while nothing is paid from it. */
export async function reopenPayrollAction(
  input: z.input<typeof runInput> & { reason: string },
  key: string,
): Promise<ActionResult<null>> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(runInput.extend({ reason: text("Why", 300) }), input);
  if (!v.ok) return v;
  const r = await callRpc<unknown>("reopen_payroll", {
    p_run: v.data.runId,
    p_reason: v.data.reason,
    p_idempotency_key: key,
  });
  if (!r.ok) return r;
  refresh(...PAYROLL_PATHS);
  return { ok: true, data: null };
}

const payInput = z.object({
  lineId: id("a line of the payroll"),
  /** None: all that is still owed. */
  amount: optionalNonNegative("Amount"),
  paidFrom,
});

/** One person's salary paid, in full or in part. */
export async function paySalaryAction(
  input: z.input<typeof payInput>,
  key: string,
): Promise<ActionResult<{ journalNo: number | null }>> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(payInput, input);
  if (!v.ok) return v;
  const r = await callRpc<Record<string, unknown>>("pay_salary", {
    p_line: v.data.lineId,
    p_amount: v.data.amount,
    p_paid_from: v.data.paidFrom,
    p_idempotency_key: key,
  });
  if (!r.ok) return r;
  refresh(...PAYROLL_PATHS);
  return {
    ok: true,
    data: { journalNo: r.data.journal_no == null ? null : Number(r.data.journal_no) },
  };
}

/** Everyone still owed their salary for the month, paid at once. */
export async function payPayrollAction(
  input: z.input<typeof runInput> & { paidFrom: string },
  key: string,
): Promise<ActionResult<{ people: number; journalNo: number | null }>> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(runInput.extend({ paidFrom }), input);
  if (!v.ok) return v;
  const r = await callRpc<Record<string, unknown>>("pay_payroll", {
    p_run: v.data.runId,
    p_paid_from: v.data.paidFrom,
    p_idempotency_key: key,
  });
  if (!r.ok) return r;
  refresh(...PAYROLL_PATHS);
  return {
    ok: true,
    data: {
      people: Number(r.data.people ?? 0),
      journalNo: r.data.journal_no == null ? null : Number(r.data.journal_no),
    },
  };
}

const cancelPaymentInput = z.object({
  paymentId: id("a salary payment"),
  reason: text("Why", 300),
});

/** A salary payment made by mistake, cancelled with why. */
export async function cancelSalaryPaymentAction(
  input: z.input<typeof cancelPaymentInput>,
  key: string,
): Promise<ActionResult<null>> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(cancelPaymentInput, input);
  if (!v.ok) return v;
  const r = await callRpc<unknown>("cancel_salary_payment", {
    p_payment: v.data.paymentId,
    p_reason: v.data.reason,
    p_idempotency_key: key,
  });
  if (!r.ok) return r;
  refresh(...PAYROLL_PATHS);
  return { ok: true, data: null };
}

const advanceInput = z.object({
  employeeId: id("someone who works here"),
  amount: positive("Amount"),
  paidFrom,
  reason: text("What it is for", 300),
});

/** An advance on someone's pay: Dr 1300, taken back from a salary. */
export async function recordAdvanceAction(
  input: z.input<typeof advanceInput>,
  key: string,
): Promise<ActionResult<{ owed: number; journalNo: number | null }>> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(advanceInput, input);
  if (!v.ok) return v;
  const r = await callRpc<Record<string, unknown>>("record_advance", {
    p_employee: v.data.employeeId,
    p_amount: v.data.amount,
    p_paid_from: v.data.paidFrom,
    p_reason: v.data.reason,
    p_location: await tillForWrite(),
    p_idempotency_key: key,
  });
  if (!r.ok) return r;
  refresh(...PAYROLL_PATHS);
  return {
    ok: true,
    data: {
      owed: Number(r.data.owed ?? 0),
      journalNo: r.data.journal_no == null ? null : Number(r.data.journal_no),
    },
  };
}

const cancelAdvanceInput = z.object({ advanceId: id("an advance"), reason: text("Why", 300) });

/** An advance given by mistake, cancelled with why while none of it is taken back. */
export async function cancelAdvanceAction(
  input: z.input<typeof cancelAdvanceInput>,
  key: string,
): Promise<ActionResult<null>> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(cancelAdvanceInput, input);
  if (!v.ok) return v;
  const r = await callRpc<unknown>("cancel_advance", {
    p_advance: v.data.advanceId,
    p_reason: v.data.reason,
    p_idempotency_key: key,
  });
  if (!r.ok) return r;
  refresh(...PAYROLL_PATHS);
  return { ok: true, data: null };
}
