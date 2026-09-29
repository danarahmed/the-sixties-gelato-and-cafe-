import "server-only";
/**
 * The balance sheet and the cash-flow statement (0052): read as the
 * signed-in person, whose permission (profit.view) the database checks.
 */
import { db, one } from "./client";
import { balanceSheetFrom, cashFlowFrom, type BalanceSheet, type CashFlow } from "@/lib/statements";

export async function getBalanceSheet(asOf: string): Promise<BalanceSheet> {
  const c = await db();
  return balanceSheetFrom(
    one(await c.rpc("report_balance_sheet", { p_as_of: asOf }), "the balance sheet"),
  );
}

export async function getCashFlow(from: string, to: string): Promise<CashFlow> {
  const c = await db();
  return cashFlowFrom(
    one(await c.rpc("report_cash_flow", { p_from: from, p_to: to }), "the cash flow"),
  );
}
