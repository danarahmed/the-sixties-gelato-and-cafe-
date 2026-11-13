import "server-only";
/**
 * Social insurance and payslips (0112). Each read is null before 0112, when
 * the database does not have it.
 */
import { db } from "./client";
import {
  payslipFrom,
  socialInsuranceFrom,
  socialInsuranceMonthFrom,
  type Payslip,
  type SocialInsurance,
  type SocialInsuranceMonth,
} from "@/lib/socialInsurance";

export type { Payslip, SocialInsurance, SocialInsuranceMonth };

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

/** Whether it is on, its two parts and who is left out (payroll.view); null before 0112. */
export async function getSocialInsurance(): Promise<SocialInsurance | null> {
  const d = await rpc("social_insurance");
  return d === null ? null : socialInsuranceFrom(d);
}

/** A month's social insurance: owed, paid and left (payroll.view); null before 0112. */
export async function getSocialInsuranceMonth(month: string): Promise<SocialInsuranceMonth | null> {
  const d = await rpc("social_insurance_month", { p_month: month });
  return d === null ? null : socialInsuranceMonthFrom(d);
}

/**
 * One person's payslip for a month (payroll.view, or the person themselves);
 * null before 0112 or when it cannot be read.
 */
export async function getPayslip(line: string): Promise<Payslip | null> {
  const c = await db();
  const r = await c.rpc("payslip", { p_line: line });
  if (r.error) return null;
  return payslipFrom(r.data);
}
