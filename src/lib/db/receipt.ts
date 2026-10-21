import "server-only";
/**
 * The café's own receipt (0091) and the reports each person opens most. Each
 * read is null before 0091, when the database does not have it.
 */
import { db } from "./client";
import { receiptSetupFrom, type ReceiptSetup } from "@/lib/receipt";

export type { ReceiptSetup };

const missing = (code: string | undefined) => code === "PGRST202" || code === "42883";

/** What the receipt prints besides the sale; null before 0091. */
export async function getReceiptSetup(): Promise<ReceiptSetup | null> {
  const c = await db();
  const r = await c.rpc("receipt_setup");
  if (r.error) {
    if (missing(r.error.code)) return null;
    throw new Error(`Could not load receipt_setup: ${r.error.message}`);
  }
  return r.data ? receiptSetupFrom(r.data) : null;
}

/** The reports the person signed in opens, most first: {path: visits}; empty before 0091. */
export async function getMyReportVisits(): Promise<Record<string, number>> {
  const c = await db();
  const r = await c.rpc("my_report_visits");
  if (r.error) return {};
  const out: Record<string, number> = {};
  for (const x of Array.isArray(r.data) ? (r.data as Record<string, unknown>[]) : []) {
    if (typeof x.path === "string") out[x.path] = Number(x.visits) || 0;
  }
  return out;
}
