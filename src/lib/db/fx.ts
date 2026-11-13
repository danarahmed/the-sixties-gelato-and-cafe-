import "server-only";
/**
 * US dollars at the till (0043, release R): the rate as the till and
 * Settings read it, and the dollars' report. Each is a database function run
 * as the signed-in person; the report is for those who may see costs.
 */
import {
  dollarsReportFrom,
  fxStatusFrom,
  ratesUsedFrom,
  type DollarsReport,
  type FxStatus,
  type RatesUsed,
} from "@/lib/fx";
import { db, one } from "./client";

export async function getFxStatus(): Promise<FxStatus> {
  const c = await db();
  return fxStatusFrom(
    one(await c.rpc("fx_status"), "the dollar rate") as Record<string, unknown> | null,
  );
}

export async function getDollarsReport(
  from: string,
  to: string,
  place: string | null = null,
): Promise<DollarsReport> {
  const c = await db();
  return dollarsReportFrom(
    one(
      await c.rpc("report_dollars", { p_from: from, p_to: to, p_location: place }),
      "the dollars",
    ) as Record<string, unknown> | null,
  );
}

/** The rates each person typed with dollar payments (0116); null before it, or for someone who may not read it. */
export async function getRatesUsed(from: string, to: string): Promise<RatesUsed | null> {
  const c = await db();
  const r = await c.rpc("usd_rates_used", { p_from: from, p_to: to });
  if (r.error) return null;
  return ratesUsedFrom(r.data);
}
