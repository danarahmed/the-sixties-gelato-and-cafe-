/**
 * Social insurance (0112), as the screens read it: whether it is on and its
 * two parts (the café's and the person's, a share of the salary), who is left
 * out for a trial period, each month's owed and paid, and a payslip.
 */
type Row = Record<string, unknown>;
const obj = (v: unknown): Row => (v && typeof v === "object" ? (v as Row) : {});
const list = (v: unknown): Row[] => (Array.isArray(v) ? v.map(obj) : []);
const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const strOrNull = (v: unknown) => (v === null || v === undefined || v === "" ? null : String(v));
const num = (v: unknown) => (v === null || v === undefined || v === "" ? 0 : Number(v));

/** Paid to the government from the bank or the safe. */
export const SI_PAID_FROM = ["bank", "safe"] as const;
export type SiPaidFrom = (typeof SI_PAID_FROM)[number];

export interface SocialInsurance {
  enabled: boolean;
  employerPercent: number;
  employeePercent: number;
  /** People who work here now and are left out (a trial period). */
  offFor: { id: string; name: string }[];
}

export function socialInsuranceFrom(v: unknown): SocialInsurance {
  const o = obj(v);
  return {
    enabled: o.enabled === true,
    employerPercent: num(o.employer_percent ?? 12),
    employeePercent: num(o.employee_percent ?? 5),
    offFor: list(o.off_for).map((p) => ({ id: str(p.id), name: str(p.name) })),
  };
}

export interface SocialInsuranceMonth {
  month: string;
  employee: number;
  employer: number;
  owed: number;
  paid: number;
  left: number;
  people: { name: string; salary: number; employee: number; employer: number }[];
}

export function socialInsuranceMonthFrom(v: unknown): SocialInsuranceMonth {
  const o = obj(v);
  return {
    month: str(o.month),
    employee: num(o.employee),
    employer: num(o.employer),
    owed: num(o.owed),
    paid: num(o.paid),
    left: num(o.left),
    people: list(o.people).map((p) => ({
      name: str(p.name),
      salary: num(p.salary),
      employee: num(p.employee),
      employer: num(p.employer),
    })),
  };
}

export interface Payslip {
  business: string;
  name: string;
  title: string | null;
  month: string;
  monthText: string;
  status: string;
  runNo: number;
  payBasis: string | null;
  rate: number | null;
  daysWorked: number;
  hours: number;
  overtimeHours: number;
  basePay: number;
  overtimePay: number;
  tips: number;
  additions: number;
  additionsNote: string | null;
  deductions: number;
  deductionsNote: string | null;
  advanceRecovered: number;
  siEmployee: number;
  siEmployer: number;
  gross: number;
  net: number;
}

export function payslipFrom(v: unknown): Payslip {
  const o = obj(v);
  return {
    business: str(o.business),
    name: str(o.name),
    title: strOrNull(o.title),
    month: str(o.month),
    monthText: str(o.month_text),
    status: str(o.status),
    runNo: num(o.run_no),
    payBasis: strOrNull(o.pay_basis),
    rate: o.rate === null || o.rate === undefined ? null : Number(o.rate),
    daysWorked: num(o.days_worked),
    hours: num(o.hours),
    overtimeHours: num(o.overtime_hours),
    basePay: num(o.base_pay),
    overtimePay: num(o.overtime_pay),
    tips: num(o.tips),
    additions: num(o.additions),
    additionsNote: strOrNull(o.additions_note),
    deductions: num(o.deductions),
    deductionsNote: strOrNull(o.deductions_note),
    advanceRecovered: num(o.advance_recovered),
    siEmployee: num(o.si_employee),
    siEmployer: num(o.si_employer),
    gross: num(o.gross),
    net: num(o.net),
  };
}
