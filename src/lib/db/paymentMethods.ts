import "server-only";
/**
 * The café's ways to pay and the money in their accounts (0069), read through
 * the database functions that check who asks. Before 0069 is applied there
 * are none, and the screens say so rather than fail.
 */
import { db } from "./client";
import {
  methodReportFrom,
  methodTakingsFrom,
  moneyAccountsFrom,
  payMethodsFrom,
  type MethodReportRow,
  type MethodTakings,
  type MoneyAccounts,
  type PayMethod,
} from "@/lib/paymentMethods";

/** The café's ways to pay, in their order, those out of use too; null before 0069 is applied. */
export async function getPaymentMethods(): Promise<PayMethod[] | null> {
  const c = await db();
  const r = await c.rpc("payment_methods");
  if (r.error) return null;
  return payMethodsFrom(r.data);
}

/** What each way to pay's account holds, the bank and the safe, and the moves; null before 0069. */
export async function getMoneyAccounts(): Promise<MoneyAccounts | null> {
  const c = await db();
  const r = await c.rpc("money_accounts");
  if (r.error) return null;
  return moneyAccountsFrom(r.data);
}

/** What each way to pay took at a place since its drawer was last counted; none before 0069. */
export async function getDrawerMethods(location?: string | null): Promise<MethodTakings[]> {
  const c = await db();
  const r = await c.rpc("drawer_methods", location ? { p_location: location } : {});
  if (r.error) return [];
  return methodTakingsFrom(r.data);
}

/** Each way to pay in the dates, at a place or the whole café; none before 0069. */
export async function getPaymentMethodReport(
  from: string,
  to: string,
  location?: string | null,
): Promise<MethodReportRow[]> {
  const c = await db();
  const r = await c.rpc("report_payment_methods", {
    p_from: from,
    p_to: to,
    ...(location ? { p_location: location } : {}),
  });
  if (r.error) return [];
  return methodReportFrom(r.data);
}
