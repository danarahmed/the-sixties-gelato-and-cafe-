import "server-only";
/**
 * Meal deals and prices by the time of day (0089): what the till offers now,
 * when its menu next changes by itself, and what the menu's screen sets. Each
 * read is null before 0089, when the database does not have it.
 */
import { db, num, str, type Row } from "./client";
import {
  dealsFrom,
  timePricesFrom,
  type Deal,
  type DealReportRow,
  type TimePrice,
} from "@/lib/deals";

export type { Deal, DealReportRow, TimePrice };

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

/** The deals on now, for the till (sale.create); none before 0089. */
export async function getPosDeals(place: string | null = null): Promise<Deal[]> {
  const d = await rpc("pos_deals", { p_location: place });
  return d === null ? [] : dealsFrom(d);
}

/** When the till's menu next changes by itself; null when nothing is set to. */
export async function getMenuNextChange(place: string | null = null): Promise<string | null> {
  try {
    const d = await rpc("pos_menu_next_change", { p_location: place });
    return typeof d === "string" ? d : null;
  } catch {
    return null;
  }
}

/** Every deal, for the menu's screen; null before 0089. */
export async function getDeals(): Promise<Deal[] | null> {
  const d = await rpc("deals_list");
  return d === null ? null : dealsFrom(d);
}

/** The prices by the hour still running; null before 0089. */
export async function getTimePrices(): Promise<TimePrice[] | null> {
  const d = await rpc("time_prices");
  return d === null ? null : timePricesFrom(d);
}

/** The deals sold between two days (cost.view); null before 0089. */
export async function getDealsReport(
  from: string,
  to: string,
  place: string | null = null,
): Promise<DealReportRow[] | null> {
  const d = await rpc("report_deals", { p_from: from, p_to: to, p_location: place });
  if (d === null) return null;
  return (Array.isArray(d) ? (d as Row[]) : []).map((r) => ({
    dealId: str(r.deal_id),
    name: str(r.name),
    sold: num(r.sold),
    full: num(r.full),
    paid: num(r.paid),
    given: num(r.given),
  }));
}
