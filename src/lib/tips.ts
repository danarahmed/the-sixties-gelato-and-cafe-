/**
 * Tips and the service charge (0090), as the screens read them: the month's
 * tips on Payroll — who shares them, each day's split, each person's total —
 * and what the till took of both, for Reports and the end of the day.
 */
type Row = Record<string, unknown>;
const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const num = (v: unknown) => (v === null || v === undefined || v === "" ? 0 : Number(v));

export interface TipShare {
  employeeId: string | null;
  /** Nobody's: the day's tips had nobody to share them. */
  name: string | null;
  amount: number;
}

export interface TipDay {
  day: string;
  location: string | null;
  tips: number;
  /** Today's: shared as things stand, settled when the day is over. */
  today: boolean;
  shares: TipShare[];
}

export interface TipsMonth {
  month: string;
  sharers: { employeeId: string; name: string; from: string }[];
  days: TipDay[];
  people: { employeeId: string; name: string; amount: number }[];
  /** What nobody shared: tips on days nobody ticked worked. */
  unshared: number;
  total: number;
}

export interface TipsAndService {
  service: number;
  serviceSales: number;
  tips: number;
  tipSales: number;
}

const rows = (d: unknown): Row[] => (Array.isArray(d) ? (d as Row[]) : []);

export function tipsMonthFrom(d: unknown): TipsMonth {
  const r = (d ?? {}) as Row;
  return {
    month: str(r.month),
    sharers: rows(r.sharers).map((x) => ({
      employeeId: str(x.employee_id),
      name: str(x.name),
      from: str(x.from),
    })),
    days: rows(r.days).map((x) => ({
      day: str(x.day),
      location: x.location == null ? null : str(x.location),
      tips: num(x.tips),
      today: x.today === true,
      shares: rows(x.shares).map((s) => ({
        employeeId: s.employee_id == null ? null : str(s.employee_id),
        name: s.name == null ? null : str(s.name),
        amount: num(s.amount),
      })),
    })),
    people: rows(r.people).map((x) => ({
      employeeId: str(x.employee_id),
      name: str(x.name),
      amount: num(x.amount),
    })),
    unshared: num(r.unshared),
    total: num(r.total),
  };
}

export function tipsAndServiceFrom(d: unknown): TipsAndService {
  const r = (d ?? {}) as Row;
  return {
    service: num(r.service),
    serviceSales: num(r.service_sales),
    tips: num(r.tips),
    tipSales: num(r.tip_sales),
  };
}
