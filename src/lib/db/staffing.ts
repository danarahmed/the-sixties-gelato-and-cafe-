import "server-only";
import { db, rows, str } from "@/lib/db/client";
import { getSalesAnalysis } from "@/lib/db/analysis";
import { addDays } from "@/lib/dates";
import type { ClockSpan, HourSales } from "@/lib/staffing";

/**
 * Staffed when busy? (round six): the orders of the days from `from` to `to`
 * by weekday and hour, as the sales analysis has them (0051, cost.view), and
 * the hours on the clock (0049; those who keep the staff, their hours or
 * their pay), at a place or everywhere. A stretch still open — someone in,
 * or who forgot to clock out — is counted, not read. Nothing on it is new.
 */
export async function getStaffing(
  from: string,
  to: string,
  location: string | null,
): Promise<{ sales: HourSales[]; spans: ClockSpan[]; open: number }> {
  const c = await db();
  let clock = c
    .from("attendance")
    .select("clock_in,clock_out")
    .is("cancelled_at", null)
    // The day before too: a night's hours after midnight fall in the first day.
    .gte("work_day", addDays(from, -1))
    .lte("work_day", to);
  if (location) clock = clock.eq("location_id", location);
  const [analysis, kept] = await Promise.all([
    getSalesAnalysis({
      from,
      to,
      by: "weekday",
      then: "hour",
      channel: null,
      location,
      category: null,
      cashier: null,
    }),
    clock.order("clock_in").limit(20_000),
  ]);
  const records = rows(kept, "the hours on the clock");
  return {
    sales: analysis.rows.map((r) => ({
      weekday: Number(r.key),
      hour: Number(r.key2),
      orders: r.orders,
      net: r.net,
    })),
    spans: records
      .filter((r) => r.clock_out)
      .map((r) => ({ clockIn: str(r.clock_in), clockOut: str(r.clock_out) })),
    open: records.filter((r) => !r.clock_out).length,
  };
}
