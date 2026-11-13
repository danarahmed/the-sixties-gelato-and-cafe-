import "server-only";
/** Budgets (0117); null before 0117, or for someone who may not read them. */
import { db } from "./client";

/** Each account's budget of the dates, its months shared by the days covered. */
export async function getBudgetFor(from: string, to: string): Promise<Map<string, number> | null> {
  const c = await db();
  const r = await c.rpc("budget_for", { p_from: from, p_to: to });
  if (r.error) return null;
  return new Map(
    ((r.data ?? []) as { code: string; amount: number }[]).map((x) => [
      String(x.code),
      Number(x.amount),
    ]),
  );
}

/** A month's budget as it was set: {code: amount}. */
export async function getBudgetMonth(month: string): Promise<Record<string, number> | null> {
  const c = await db();
  const r = await c.rpc("budget_month", { p_month: month });
  if (r.error) return null;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries((r.data ?? {}) as Record<string, unknown>))
    out[k] = Number(v);
  return out;
}
