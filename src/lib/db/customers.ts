import "server-only";
/**
 * Customers, what each bought, their points, and the loyalty report (0050).
 * All from database functions that check the person's permission: the list
 * and a customer's history are for those who see customers.
 */
import { db, one } from "./client";
import {
  customerDetailFrom,
  customerReportFrom,
  customerRowsFrom,
  type CustomerDetail,
  type CustomerReport,
  type CustomerRow,
} from "@/lib/customers";

export async function getCustomers(): Promise<CustomerRow[]> {
  const c = await db();
  return customerRowsFrom(one(await c.rpc("customer_list"), "the customers"));
}

/** A customer, with their addresses, what they bought and how their points moved; null when there is none. */
export async function getCustomer(id: string): Promise<CustomerDetail | null> {
  const c = await db();
  const r = await c.rpc("customer_detail", { p_customer: id });
  if (r.error && /Customer not found/.test(r.error.message)) return null;
  return customerDetailFrom(one(r, "the customer"));
}

export async function getCustomerReport(from: string, to: string): Promise<CustomerReport> {
  const c = await db();
  return customerReportFrom(
    one(await c.rpc("report_customers", { p_from: from, p_to: to }), "the loyalty report"),
  );
}
