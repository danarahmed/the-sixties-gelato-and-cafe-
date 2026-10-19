import "server-only";
/**
 * Customers on account (0077). Null before the owner applies 0077: the
 * screens then show nothing of them.
 */
import { db } from "./client";
import {
  accountRows,
  customerAccount,
  type AccountRow,
  type CustomerAccount,
} from "@/lib/accounts";

export async function getCustomerAccount(id: string): Promise<CustomerAccount | null> {
  const c = await db();
  const { data, error } = await c.rpc("customer_account", { p_customer: id });
  if (error) return null;
  return customerAccount(data);
}

export async function getCustomerAccounts(): Promise<{
  rows: AccountRow[];
  books: number | null;
} | null> {
  const c = await db();
  const { data, error } = await c.rpc("customer_accounts");
  if (error) return null;
  return accountRows(data);
}
