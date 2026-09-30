"use server";
/**
 * The bank reconciled against its statement (0059): a statement kept, the
 * latest undone. The database checks that the lines ticked take the bank to
 * the balance the bank gives, and that each line is on one statement.
 */
import { z } from "zod";
import { badKey, callRpc, parse, refresh, type ActionResult } from "@/lib/db/rpc";
import { day, id, optionalText, signed, text } from "@/lib/validation";

const BANK_PATHS = ["/accounting/bank", "/accounting", "/dashboard"];

const statementInput = z.object({
  date: day("The statement's last day"),
  closing: signed("The balance on the statement"),
  lines: z.array(z.string().uuid("Choose the lines on the statement")).max(2000),
  note: optionalText(500),
});

export async function saveBankStatementAction(
  input: z.input<typeof statementInput>,
  key: string,
): Promise<ActionResult<{ id: string; statementNo: number }>> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(statementInput, input);
  if (!v.ok) return v;
  const r = await callRpc<Record<string, unknown>>("save_bank_statement", {
    p_date: v.data.date,
    p_closing: v.data.closing,
    p_lines: v.data.lines,
    p_note: v.data.note,
    p_idempotency_key: key,
  });
  if (!r.ok) return r;
  refresh(...BANK_PATHS);
  return { ok: true, data: { id: String(r.data.id), statementNo: Number(r.data.statement_no) } };
}

const undoInput = z.object({
  statementId: id("the statement"),
  reason: text("Why", 300),
});

export async function undoBankStatementAction(
  input: z.input<typeof undoInput>,
  key: string,
): Promise<ActionResult<{ statementNo: number }>> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(undoInput, input);
  if (!v.ok) return v;
  const r = await callRpc<Record<string, unknown>>("undo_bank_statement", {
    p_statement: v.data.statementId,
    p_reason: v.data.reason,
    p_idempotency_key: key,
  });
  if (!r.ok) return r;
  refresh(...BANK_PATHS);
  return { ok: true, data: { statementNo: Number(r.data.statement_no) } };
}
