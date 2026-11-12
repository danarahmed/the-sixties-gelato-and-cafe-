import "server-only";
/** Comparing cashiers (0104): for the owner and the managers; null before 0104 or for anyone else. */
import { db } from "./client";

export interface CashierRow {
  memberId: string;
  name: string;
  bills: number;
  sales: number;
  averageBill: number | null;
  itemsPerBill: number | null;
  addonsPerBill: number | null;
  hours: number;
  salesPerHour: number | null;
  /** Their sales an hour against the café's usual in the same hours: 100 is as usual. */
  againstUsual: number | null;
  voids: number;
  refunds: number;
  discounts: number;
  discounted: number;
  drawer: number;
}

const n = (v: unknown) => (v == null ? null : Number(v));

export async function getCashierScorecard(from: string, to: string): Promise<CashierRow[] | null> {
  const c = await db();
  const r = await c.rpc("report_cashier_scorecard", { p_from: from, p_to: to, p_location: null });
  if (r.error || !r.data) return null;
  const rows = (r.data as { cashiers?: unknown }).cashiers;
  return (Array.isArray(rows) ? (rows as Record<string, unknown>[]) : []).map((x) => ({
    memberId: String(x.member_id),
    name: String(x.name ?? "—"),
    bills: Number(x.bills ?? 0),
    sales: Number(x.sales ?? 0),
    averageBill: n(x.average_bill),
    itemsPerBill: n(x.items_per_bill),
    addonsPerBill: n(x.addons_per_bill),
    hours: Number(x.hours ?? 0),
    salesPerHour: n(x.sales_per_hour),
    againstUsual: n(x.against_usual),
    voids: Number(x.voids ?? 0),
    refunds: Number(x.refunds ?? 0),
    discounts: Number(x.discounts ?? 0),
    discounted: Number(x.discounted ?? 0),
    drawer: Number(x.drawer ?? 0),
  }));
}
