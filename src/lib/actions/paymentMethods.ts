"use server";
/**
 * The café's ways to pay and the money in their accounts (0069). Each action
 * is one database function: what it records, its journal and its audit row
 * are written together or not at all, and the function checks the person may.
 */
import { z } from "zod";
import { badKey, callRpc, parse, refresh, type ActionResult } from "@/lib/db/rpc";
import { day, id, nonNegative, optionalText, text } from "@/lib/validation";
import { payMethodsFrom, type PayMethod } from "@/lib/paymentMethods";

/** The till offers them, Settings lists them, Sales and the reports read their money. */
const METHOD_PATHS = ["/settings", "/pos", "/sales", "/end-of-day", "/reports"];
const MONEY_PATHS = ["/sales", "/journals", "/accounting", "/reports", "/dashboard"];

const methodInput = z.object({
  /** None: a new way to pay, given an account of its own. */
  id: id("a way to pay").nullish(),
  name: text("The name", 40),
  active: z.boolean().nullish(),
  position: z.number().int().min(0).max(1000).nullish(),
});

/** A new way to pay, or one renamed, moved in the list, taken out of use or brought back. */
export async function savePaymentMethodAction(
  input: z.input<typeof methodInput>,
  key: string,
): Promise<ActionResult<PayMethod>> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(methodInput, input);
  if (!v.ok) return v;
  const r = await callRpc<Record<string, unknown>>("save_payment_method", {
    p_method: v.data.id ?? null,
    p_name: v.data.name,
    p_active: v.data.active ?? null,
    p_position: v.data.position ?? null,
    p_idempotency_key: key,
  });
  if (!r.ok) return r;
  refresh(...METHOD_PATHS);
  const [m] = payMethodsFrom([r.data]);
  return { ok: true, data: m! };
}

const ACCOUNT = /^10\d\d$/;
const moveInput = z.object({
  /** The account it leaves: a way to pay's, the bank (1020) or the safe (1005). */
  from: z.string().regex(ACCOUNT, "Choose where the money is moved from"),
  /** Where it goes; none: a charge alone. */
  to: z
    .string()
    .regex(ACCOUNT, "Choose where the money goes: the bank, the safe or another way to pay")
    .nullish(),
  /** What arrived. */
  amount: nonNegative("What arrived"),
  /** What the bank or the app kept. */
  fee: nonNegative("The fee"),
  on: day("The day").nullish(),
  reference: optionalText(60),
  note: optionalText(300),
});

/** Money moved out of a way to pay's account, or into one, with its fee; or a charge alone. */
export async function moveMoneyAction(
  input: z.input<typeof moveInput>,
  key: string,
): Promise<ActionResult<{ journalNo: number | null }>> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(moveInput, input);
  if (!v.ok) return v;
  const r = await callRpc<Record<string, unknown>>("move_money", {
    p_from: v.data.from,
    p_to: v.data.to ?? null,
    p_amount: v.data.amount,
    p_fee: v.data.fee,
    p_on: v.data.on ?? null,
    p_reference: v.data.reference,
    p_note: v.data.note,
    p_idempotency_key: key,
  });
  if (!r.ok) return r;
  refresh(...MONEY_PATHS);
  return {
    ok: true,
    data: { journalNo: r.data.journal_no == null ? null : Number(r.data.journal_no) },
  };
}

const cancelInput = z.object({
  id: id("a move of money"),
  reason: text("Why it is cancelled", 300),
});

/** A move of money undone, with why: its journal reversed today. */
export async function cancelMoneyMoveAction(
  input: z.input<typeof cancelInput>,
  key: string,
): Promise<ActionResult<null>> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(cancelInput, input);
  if (!v.ok) return v;
  const r = await callRpc("cancel_money_move", {
    p_move: v.data.id,
    p_reason: v.data.reason,
    p_idempotency_key: key,
  });
  if (!r.ok) return r;
  refresh(...MONEY_PATHS);
  return { ok: true, data: null };
}
