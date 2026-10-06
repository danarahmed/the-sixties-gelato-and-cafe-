import "server-only";
import { db, str } from "@/lib/db/client";
import { readPaged } from "@/lib/db/batches";
import { getSalesAnalysis } from "@/lib/db/analysis";
import { addDays } from "@/lib/dates";
import type { ClockSpan, DayHourSales, HourSales, StaffSpan } from "@/lib/staffing";

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
): Promise<{ sales: HourSales[]; spans: ClockSpan[]; staffSpans: StaffSpan[]; open: number }> {
  const c = await db();
  const clock = () => {
    const q = c
      .from("attendance")
      .select("id,employee_id,clock_in,clock_out")
      .is("cancelled_at", null)
      // The day before too: a night's hours after midnight fall in the first day.
      .gte("work_day", addDays(from, -1))
      .lte("work_day", to);
    return (location ? q.eq("location_id", location) : q).order("clock_in").order("id");
  };
  const [analysis, records] = await Promise.all([
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
    readPaged(clock, "the hours on the clock"),
  ]);
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
    staffSpans: records
      .filter((r) => r.clock_out)
      .map((r) => ({
        employeeId: str(r.employee_id),
        clockIn: str(r.clock_in),
        clockOut: str(r.clock_out),
      })),
    open: records.filter((r) => !r.clock_out).length,
  };
}

/**
 * Net sales by day and hour from `from` to `to` (the sales analysis by date,
 * then hour; cost.view), for what the hours on the clock cost against them
 * (round ten).
 */
export async function getSalesByDayHour(
  from: string,
  to: string,
  location: string | null,
): Promise<DayHourSales[]> {
  const analysis = await getSalesAnalysis({
    from,
    to,
    by: "date",
    then: "hour",
    channel: null,
    location,
    category: null,
    cashier: null,
  });
  return analysis.rows.map((r) => ({ day: String(r.key), hour: Number(r.key2), net: r.net }));
}

/**
 * The labour cost the café aims for, a share of net sales (0071): a place's
 * own, else the café's; 0 is none. Null before 0071 is applied, or for
 * someone who sees no pay.
 */
export async function getLabourTarget(place: string | null): Promise<number | null> {
  const c = await db();
  const r = await c.rpc("labour_target", { p_location: place });
  if (r.error) return null;
  const n = Number(r.data ?? 0);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
