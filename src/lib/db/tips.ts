import "server-only";
/**
 * Tips and the service charge (0090): the charge on each way of selling, the
 * month's tips on Payroll, and what the till took of both. Each read is null
 * before 0090, when the database does not have it.
 */
import { db } from "./client";
import { tipsAndServiceFrom, tipsMonthFrom, type TipsAndService, type TipsMonth } from "@/lib/tips";

export type { TipsAndService, TipsMonth };

const missing = (code: string | undefined) => code === "PGRST202" || code === "42883";

async function rpc(name: string, args: Record<string, unknown> = {}): Promise<unknown> {
  const c = await db();
  const r = await c.rpc(name, args);
  if (r.error) {
    if (missing(r.error.code)) return null;
    throw new Error(`Could not load ${name}: ${r.error.message}`);
  }
  return r.data;
}

/** {channel: percent} for each way of selling that takes a service charge; null before 0090. */
export async function getServiceCharges(): Promise<Record<string, number> | null> {
  const d = await rpc("service_charges");
  if (d === null) return null;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries((d ?? {}) as Record<string, unknown>)) out[k] = Number(v);
  return out;
}

/** The month's tips, for Payroll (payroll.view); null before 0090. */
export async function getTipsMonth(month: string): Promise<TipsMonth | null> {
  const d = await rpc("tips_month", { p_month: month });
  return d === null ? null : tipsMonthFrom(d);
}

/** The service charge and tips the till took between two days (cost.view); null before 0090. */
export async function getTipsAndService(
  from: string,
  to: string,
  location: string | null = null,
): Promise<TipsAndService | null> {
  const d = await rpc("report_tips_and_service", { p_from: from, p_to: to, p_location: location });
  return d === null ? null : tipsAndServiceFrom(d);
}
