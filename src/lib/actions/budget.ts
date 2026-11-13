"use server";
/** Budgets (0117): the owner or the accountant sets a month's. The database checks who may. */
import { z } from "zod";
import { callRpc, parse, refresh, type ActionResult } from "@/lib/db/rpc";
import { day } from "@/lib/validation";

const budgetInput = z.object({
  month: day("The month"),
  lines: z.record(
    z.string().regex(/^\d{4}$/, "Choose the account"),
    z.number().min(0, "A budget is 0 or more"),
  ),
});

export async function setBudgetAction(
  input: z.input<typeof budgetInput>,
): Promise<ActionResult<{ accounts: number }>> {
  const v = parse(budgetInput, input);
  if (!v.ok) return v;
  const r = await callRpc<Record<string, unknown>>("set_budget", {
    p_month: v.data.month,
    p_lines: v.data.lines,
  });
  if (!r.ok) return r;
  refresh("/reports/compare", "/reports");
  return { ok: true, data: { accounts: Number(r.data.accounts ?? 0) } };
}
