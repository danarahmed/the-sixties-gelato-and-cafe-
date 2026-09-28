import "server-only";
/**
 * US dollars at the till (0043, release R): the rate as the till and
 * Settings read it, and the dollars' report. Each is a database function run
 * as the signed-in person; the report is for those who may see costs.
 */
import { dollarsReportFrom, fxStatusFrom, type DollarsReport, type FxStatus } from "@/lib/fx";
import { db, one } from "./client";

export async function getFxStatus(): Promise<FxStatus> {
  const c = await db();
  return fxStatusFrom(
    one(await c.rpc("fx_status"), "the dollar rate") as Record<string, unknown> | null,
  );
}

export async function getDollarsReport(from: string, to: string): Promise<DollarsReport> {
  const c = await db();
  return dollarsReportFrom(
    one(await c.rpc("report_dollars", { p_from: from, p_to: to }), "the dollars") as Record<
      string,
      unknown
    > | null,
  );
}
