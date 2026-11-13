"use server";
/**
 * Social insurance (0112): the owner turns it on or off and sets its two
 * parts; payroll.run leaves a person out for a trial period, and pays the
 * government what a month owes. The database checks who may, and posts the
 * journals.
 */
import { z } from "zod";
import { badKey, callRpc, parse, refresh, type ActionResult } from "@/lib/db/rpc";
import { day, id, optionalText, positive } from "@/lib/validation";
import { SI_PAID_FROM, socialInsuranceFrom, socialInsuranceMonthFrom } from "@/lib/socialInsurance";
import type { SocialInsurance, SocialInsuranceMonth } from "@/lib/socialInsurance";

const PATHS = ["/payroll", "/journals", "/reports", "/dashboard"];

const percent = z
  .number({ message: "Each part is from 0% to 50% of the salary" })
  .min(0, "Each part is from 0% to 50% of the salary")
  .max(50, "Each part is from 0% to 50% of the salary");

const setupInput = z.object({ enabled: z.boolean(), employer: percent, employee: percent });

export async function setSocialInsuranceAction(
  input: z.input<typeof setupInput>,
): Promise<ActionResult<SocialInsurance>> {
  const v = parse(setupInput, input);
  if (!v.ok) return v;
  const r = await callRpc<unknown>("set_social_insurance", {
    p_enabled: v.data.enabled,
    p_employer: v.data.employer,
    p_employee: v.data.employee,
  });
  if (!r.ok) return r;
  refresh("/payroll");
  return { ok: true, data: socialInsuranceFrom(r.data) };
}

const personInput = z.object({ employeeId: id("a person"), on: z.boolean() });

export async function setEmployeeSocialInsuranceAction(
  input: z.input<typeof personInput>,
): Promise<ActionResult<null>> {
  const v = parse(personInput, input);
  if (!v.ok) return v;
  const r = await callRpc<unknown>("set_employee_social_insurance", {
    p_employee: v.data.employeeId,
    p_on: v.data.on,
  });
  if (!r.ok) return r;
  refresh("/payroll");
  return { ok: true, data: null };
}

const payInput = z.object({
  month: day("The month"),
  amount: positive("The amount"),
  paidFrom: z.enum(SI_PAID_FROM, {
    message: "Say where the money came from: the bank or the safe",
  }),
  reference: optionalText(60),
});

export async function paySocialInsuranceAction(
  input: z.input<typeof payInput>,
  key: string,
): Promise<ActionResult<SocialInsuranceMonth>> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(payInput, input);
  if (!v.ok) return v;
  const r = await callRpc<unknown>("pay_social_insurance", {
    p_month: v.data.month,
    p_amount: v.data.amount,
    p_paid_from: v.data.paidFrom,
    p_reference: v.data.reference ?? null,
    p_idempotency_key: key,
  });
  if (!r.ok) return r;
  refresh(...PATHS);
  return { ok: true, data: socialInsuranceMonthFrom(r.data) };
}
