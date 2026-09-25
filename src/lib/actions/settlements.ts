"use server";
/**
 * Card and platform money, settled (0030, the audit's P1-9). Each action is
 * one database function: the settlement, its journal and its audit row are
 * written together or not at all, and the function checks the person may.
 */
import { z } from "zod";
import { callRpc, parse, refresh, type ActionResult } from "@/lib/db/rpc";
import { day, id, nonNegative, optionalText, text } from "@/lib/validation";
import { parseMatch, type StatementMatch } from "@/lib/settlements";

const MONEY_PATHS = ["/sales", "/platforms", "/journals", "/accounting", "/reports", "/dashboard"];

const cardInput = z.object({
  /** The last day the settlement covers; it starts the day after the last one. */
  through: day("The last day"),
  terminalTotal: nonNegative("The terminal's total"),
  received: nonNegative("What reached the bank"),
  receivedOn: day("The day it arrived").nullish(),
  reference: optionalText(80),
  note: optionalText(300),
});

/** The card takings up to a day, against the terminal's report and what reached the bank. */
export async function recordCardSettlementAction(
  input: z.input<typeof cardInput>,
): Promise<ActionResult<{ fee: number; difference: number; journalNo: number | null }>> {
  const v = parse(cardInput, input);
  if (!v.ok) return v;
  const r = await callRpc<Record<string, unknown>>("record_card_settlement", {
    p_through: v.data.through,
    p_terminal_total: v.data.terminalTotal,
    p_received: v.data.received,
    p_received_on: v.data.receivedOn ?? null,
    p_reference: v.data.reference,
    p_note: v.data.note,
  });
  if (!r.ok) return r;
  refresh(...MONEY_PATHS);
  return {
    ok: true,
    data: {
      fee: Number(r.data.fee ?? 0),
      difference: Number(r.data.difference ?? 0),
      journalNo: r.data.journal_no == null ? null : Number(r.data.journal_no),
    },
  };
}

const cancelInput = z.object({
  id: id("a settlement"),
  reason: text("Why it is cancelled", 300),
});

/** The latest card settlement undone: its journal reversed, its days waiting again. */
export async function cancelCardSettlementAction(
  input: z.input<typeof cancelInput>,
): Promise<ActionResult<null>> {
  const v = parse(cancelInput, input);
  if (!v.ok) return v;
  const r = await callRpc("cancel_card_settlement", {
    p_settlement: v.data.id,
    p_reason: v.data.reason,
  });
  if (!r.ok) return r;
  refresh(...MONEY_PATHS);
  return { ok: true, data: null };
}

const amount = z.string().regex(/^-?\d+(\.\d+)?$/, "An amount on the statement is not a number");
const statementLines = z
  .array(
    z.object({
      orderNo: z.string().min(1).max(40),
      payout: amount,
      commission: amount.nullable(),
      fees: amount.nullable(),
    }),
  )
  .min(1, "The statement has no lines")
  .max(2000, "A statement is matched 2,000 lines at a time");
/** A platform's code ("talabat"); the database checks it is one of the business's. */
const PLATFORM = z.string().regex(/^[a-z_]{1,40}$/, "Choose the platform");

const toRpcLines = (lines: z.infer<typeof statementLines>) =>
  lines.map((l) => ({
    order_no: l.orderNo,
    payout: l.payout,
    ...(l.commission !== null ? { commission: l.commission } : {}),
    ...(l.fees !== null ? { fees: l.fees } : {}),
  }));

const matchInput = z.object({ platform: PLATFORM, lines: statementLines });

/** A statement against the orders waiting to be paid out. Nothing is written. */
export async function matchStatementAction(
  input: z.input<typeof matchInput>,
): Promise<ActionResult<StatementMatch>> {
  const v = parse(matchInput, input);
  if (!v.ok) return v;
  const r = await callRpc<unknown>("match_platform_statement", {
    p_platform: v.data.platform,
    p_lines: toRpcLines(v.data.lines),
  });
  if (!r.ok) return r;
  return { ok: true, data: parseMatch(r.data) };
}

const postInput = matchInput.extend({
  reference: text("The statement's number or date", 80),
  receivedOn: day("The day it arrived").nullish(),
  note: optionalText(500),
});

/** Post what the match proposes: the payout in, commission and fees, the orders out of 1100. */
export async function postStatementAction(
  input: z.input<typeof postInput>,
): Promise<ActionResult<{ orders: number; issues: number; journalNo: number | null }>> {
  const v = parse(postInput, input);
  if (!v.ok) return v;
  const r = await callRpc<Record<string, unknown>>("post_platform_settlement", {
    p_platform: v.data.platform,
    p_reference: v.data.reference,
    p_lines: toRpcLines(v.data.lines),
    p_received_on: v.data.receivedOn ?? null,
    p_note: v.data.note,
  });
  if (!r.ok) return r;
  refresh(...MONEY_PATHS);
  return {
    ok: true,
    data: {
      orders: Number(r.data.order_count ?? 0),
      issues: Number(r.data.issues ?? 0),
      journalNo: r.data.journal_no == null ? null : Number(r.data.journal_no),
    },
  };
}

/** A platform payout undone: its journal reversed, its orders waiting again. */
export async function cancelPlatformSettlementAction(
  input: z.input<typeof cancelInput>,
): Promise<ActionResult<null>> {
  const v = parse(cancelInput, input);
  if (!v.ok) return v;
  const r = await callRpc("cancel_platform_settlement", {
    p_settlement: v.data.id,
    p_reason: v.data.reason,
  });
  if (!r.ok) return r;
  refresh(...MONEY_PATHS);
  return { ok: true, data: null };
}
