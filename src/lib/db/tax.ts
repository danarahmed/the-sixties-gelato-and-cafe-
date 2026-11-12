import "server-only";
/** Tax (0102): built in and off until the café turns it on. Null before 0102. */
import { db } from "./client";

export interface TaxSetup {
  enabled: boolean;
  kind: "vat" | "sales_tax";
  rate: number;
}

export interface TaxReport {
  collected: number;
  givenBack: number;
  paid: number;
  owed: number;
}

export async function getTaxSetup(): Promise<TaxSetup | null> {
  const c = await db();
  const r = await c.rpc("tax_setup");
  if (r.error || !r.data) return null;
  const d = r.data as Record<string, unknown>;
  return {
    enabled: d.enabled === true,
    kind: d.kind === "sales_tax" ? "sales_tax" : "vat",
    rate: Number(d.rate ?? 0),
  };
}

export async function getTaxReport(from: string, to: string): Promise<TaxReport | null> {
  const c = await db();
  const r = await c.rpc("report_tax", { p_from: from, p_to: to });
  if (r.error || !r.data) return null;
  const d = r.data as Record<string, unknown>;
  return {
    collected: Number(d.collected ?? 0),
    givenBack: Number(d.given_back ?? 0),
    paid: Number(d.paid ?? 0),
    owed: Number(d.owed ?? 0),
  };
}
