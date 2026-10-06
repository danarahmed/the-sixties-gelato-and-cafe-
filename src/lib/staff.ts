/**
 * Who works here, their hours and their pay (0049, release W): the words the
 * screens give them and the shapes they read. Pure: the pages, the forms and
 * the tests read through here.
 */
import { addDays, dateTimeIn } from "@/lib/dates";

/** How someone is paid. */
export const PAY_BASES = ["monthly", "daily", "hourly"] as const;
export type PayBasis = (typeof PAY_BASES)[number];

/** How someone is paid, as Staff names it: a phrase, shown through t(). */
export const PAY_BASIS_LABEL: Record<PayBasis, string> = {
  monthly: "By the month",
  daily: "By the day",
  hourly: "By the hour",
};

/** What a rate is for: "600,000 a month". Phrases, shown through t(). */
export const RATE_PER: Record<PayBasis, string> = {
  monthly: "{amount} a month",
  daily: "{amount} a day",
  hourly: "{amount} an hour",
};

/** Where money for staff comes from (the database takes these four). */
export const STAFF_PAID_FROM = ["bank", "safe", "till", "owner"] as const;
export type StaffPaidFrom = (typeof STAFF_PAID_FROM)[number];
export const PAID_FROM_LABEL: Record<StaffPaidFrom, string> = {
  bank: "The bank",
  safe: "The safe",
  till: "The till's drawer",
  owner: "The owner, from their own pocket",
};

/** A payroll's state: phrases, shown through t(). */
export const RUN_STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  approved: "Approved",
  paid: "Paid",
};

/** A record of hours' source: phrases, shown through t(). */
export const SOURCE_LABEL: Record<string, string> = {
  till: "Clocked at the till",
  manager: "Added by a manager",
  phone: "Clocked on their phone",
};

/** Whole hours and minutes of a number of minutes. */
export function splitMinutes(minutes: number): { h: number; m: number } {
  const total = Math.max(0, Math.round(minutes));
  return { h: Math.floor(total / 60), m: total % 60 };
}

/** The first day of the café's week (a Saturday) on or before a day. */
export function weekStart(day: string): string {
  const dow = new Date(`${day}T00:00:00Z`).getUTCDay(); // Sunday 0 … Saturday 6
  return addDays(day, -((dow + 1) % 7));
}

/** The seven days of the week a day falls in, Saturday first. */
export function weekDays(day: string): string[] {
  const from = weekStart(day);
  return Array.from({ length: 7 }, (_, i) => addDays(from, i));
}

/** "08:00" of a stored time, on the café's clock. */
export function clockTime(iso: string | null, timezone: string): string {
  if (!iso) return "";
  const s = dateTimeIn(timezone, iso);
  return s === "—" ? "" : s.slice(11, 16);
}

/** "2026-09" of a month's first day. */
export function monthText(month: string): string {
  return month.slice(0, 7);
}

/** A time typed as "8", "8:30", "08:30" or "0830", as 08:30; null when it is not a time. */
export function typedTime(input: string): string | null {
  const s = input.trim().replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
  const m = /^(\d{1,2})(?::?(\d{2}))?$/.exec(s);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2] ?? "0");
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/** Hours typed for a day, "08:00-16:00": the start and the end, or null. */
export function typedHours(input: string): { starts: string; ends: string } | null {
  const parts = input
    .trim()
    .split(/\s*[-–—]\s*|\s+to\s+/)
    .filter(Boolean);
  if (parts.length !== 2) return null;
  const starts = typedTime(parts[0] ?? "");
  const ends = typedTime(parts[1] ?? "");
  if (!starts || !ends || starts === ends) return null;
  return { starts, ends };
}

export interface StaffMember {
  id: string;
  name: string;
  phone: string | null;
  title: string | null;
  locationId: string;
  location: string;
  hiredOn: string;
  leftOn: string | null;
  worksNow: boolean;
  appUserId: string | null;
  login: string | null;
  hasPin: boolean;
  /** When they clocked in, while they are in. */
  inSince: string | null;
  attendanceId: string | null;
  paySet: boolean;
  /** Only for those who see payroll. */
  pay: {
    basis: PayBasis | null;
    rate: number | null;
    standardHours: number;
    overtimePercent: number | null;
    advanceOwed: number;
  } | null;
}

export function staffFrom(v: unknown): StaffMember[] {
  return list(v).map((r) => ({
    id: str(r.id),
    name: str(r.name),
    phone: strOrNull(r.phone),
    title: strOrNull(r.title),
    locationId: str(r.location_id),
    location: str(r.location),
    hiredOn: str(r.hired_on),
    leftOn: strOrNull(r.left_on),
    worksNow: r.works_now === true,
    appUserId: strOrNull(r.app_user_id),
    login: strOrNull(r.login),
    hasPin: r.has_pin === true,
    inSince: strOrNull(r.in_since),
    attendanceId: strOrNull(r.attendance_id),
    paySet: r.pay_set === true,
    pay:
      "rate" in r || "pay_basis" in r
        ? {
            basis: PAY_BASES.includes(r.pay_basis as PayBasis) ? (r.pay_basis as PayBasis) : null,
            rate: numOrNull(r.rate),
            standardHours: num(r.standard_hours),
            overtimePercent: numOrNull(r.overtime_percent),
            advanceOwed: num(r.advance_owed),
          }
        : null,
  }));
}

export interface ClockPerson {
  employeeId: string;
  name: string;
  title: string | null;
  hasPin: boolean;
  /** Their own phone is linked (0068): with a clock screen in use, they clock with it. */
  hasPhone: boolean;
  inSince: string | null;
  shiftStarts: string | null;
  shiftEnds: string | null;
}

export function clockBoardFrom(v: unknown): ClockPerson[] {
  return list(v).map((r) => ({
    employeeId: str(r.employee_id),
    name: str(r.name),
    title: strOrNull(r.title),
    hasPin: r.has_pin === true,
    hasPhone: r.has_phone === true,
    inSince: strOrNull(r.in_since),
    shiftStarts: strOrNull(r.shift_starts),
    shiftEnds: strOrNull(r.shift_ends),
  }));
}

/** What clocking in or out answered: done, or why not. */
export interface ClockAnswer {
  ok: boolean;
  error: string | null;
  name: string | null;
  clockIn: string | null;
  clockOut: string | null;
  minutes: number | null;
  lateMinutes: number | null;
  earlyMinutes: number | null;
}

export function clockAnswerFrom(v: unknown): ClockAnswer {
  const o = obj(v);
  return {
    ok: o.ok === true,
    error: strOrNull(o.error),
    name: strOrNull(o.name),
    clockIn: strOrNull(o.clock_in),
    clockOut: strOrNull(o.clock_out),
    minutes: numOrNull(o.minutes),
    lateMinutes: numOrNull(o.late_minutes),
    earlyMinutes: numOrNull(o.early_minutes),
  };
}

export interface SchedulePerson {
  id: string;
  name: string;
  title: string | null;
  locationId: string;
  hiredOn: string;
  leftOn: string | null;
}

export interface Shift {
  id: string;
  employeeId: string;
  locationId: string;
  location: string;
  day: string;
  startsAt: string;
  endsAt: string;
  note: string | null;
  /** Its month's pay is approved: it no longer changes. */
  settled: boolean;
}

export interface Schedule {
  from: string;
  to: string;
  people: SchedulePerson[];
  shifts: Shift[];
}

export function scheduleFrom(v: unknown): Schedule {
  const o = obj(v);
  return {
    from: str(o.from),
    to: str(o.to),
    people: list(o.people).map((p) => ({
      id: str(p.id),
      name: str(p.name),
      title: strOrNull(p.title),
      locationId: str(p.location_id),
      hiredOn: str(p.hired_on),
      leftOn: strOrNull(p.left_on),
    })),
    shifts: list(o.shifts).map((s) => ({
      id: str(s.id),
      employeeId: str(s.employee_id),
      locationId: str(s.location_id),
      location: str(s.location),
      day: str(s.day),
      startsAt: str(s.starts_at),
      endsAt: str(s.ends_at),
      note: strOrNull(s.note),
      settled: s.settled === true,
    })),
  };
}

/** Whether someone works here on a day: started, and not yet left. */
export function worksOn(p: { hiredOn: string; leftOn: string | null }, day: string): boolean {
  return p.hiredOn <= day && (p.leftOn === null || p.leftOn >= day);
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  name: string;
  location: string;
  day: string;
  clockIn: string;
  clockOut: string | null;
  minutes: number;
  /** Clocked in for longer than the rule's hours. */
  long: boolean;
  source: string;
  recordedBy: string | null;
  editedBy: string | null;
  editedAt: string | null;
  editReason: string | null;
  cancelledBy: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  settled: boolean;
}

export interface AttendanceDay {
  employeeId: string;
  name: string;
  day: string;
  shiftStarts: string | null;
  shiftEnds: string | null;
  firstIn: string | null;
  lastOut: string | null;
  minutes: number;
  overtimeMinutes: number;
  lateMinutes: number | null;
  earlyMinutes: number | null;
  absent: boolean;
  stillIn: boolean;
}

export function attendanceFrom(v: unknown): { records: AttendanceRecord[]; days: AttendanceDay[] } {
  const o = obj(v);
  return {
    records: list(o.records).map((r) => ({
      id: str(r.id),
      employeeId: str(r.employee_id),
      name: str(r.name),
      location: str(r.location),
      day: str(r.day),
      clockIn: str(r.clock_in),
      clockOut: strOrNull(r.clock_out),
      minutes: num(r.minutes),
      long: r.long === true,
      source: str(r.source),
      recordedBy: strOrNull(r.recorded_by),
      editedBy: strOrNull(r.edited_by),
      editedAt: strOrNull(r.edited_at),
      editReason: strOrNull(r.edit_reason),
      cancelledBy: strOrNull(r.cancelled_by),
      cancelledAt: strOrNull(r.cancelled_at),
      cancelReason: strOrNull(r.cancel_reason),
      settled: r.settled === true,
    })),
    days: list(o.days).map((d) => ({
      employeeId: str(d.employee_id),
      name: str(d.name),
      day: str(d.day),
      shiftStarts: strOrNull(d.shift_starts),
      shiftEnds: strOrNull(d.shift_ends),
      firstIn: strOrNull(d.first_in),
      lastOut: strOrNull(d.last_out),
      minutes: num(d.minutes),
      overtimeMinutes: num(d.overtime_minutes),
      lateMinutes: numOrNull(d.late_minutes),
      earlyMinutes: numOrNull(d.early_minutes),
      absent: d.absent === true,
      stillIn: d.still_in === true,
    })),
  };
}

export interface PayrollRunRow {
  id: string;
  runNo: number;
  month: string;
  status: string;
  draftedAt: string | null;
  draftedBy: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  journalNo: number | null;
  people: number;
  gross: number;
  net: number;
  paid: number;
}

export function payrollRunsFrom(v: unknown): PayrollRunRow[] {
  return list(v).map((r) => ({
    id: str(r.id),
    runNo: num(r.run_no),
    month: str(r.month),
    status: str(r.status),
    draftedAt: strOrNull(r.drafted_at),
    draftedBy: strOrNull(r.drafted_by),
    approvedAt: strOrNull(r.approved_at),
    approvedBy: strOrNull(r.approved_by),
    journalNo: numOrNull(r.journal_no),
    people: num(r.people),
    gross: num(r.gross),
    net: num(r.net),
    paid: num(r.paid),
  }));
}

export interface PayrollLine {
  id: string;
  employeeId: string;
  name: string;
  title: string | null;
  payBasis: PayBasis | null;
  rate: number | null;
  standardHours: number;
  overtimePercent: number;
  daysInMonth: number;
  daysEmployed: number;
  daysWorked: number;
  minutesWorked: number;
  overtimeMinutes: number;
  daysScheduled: number;
  daysAbsent: number;
  timesLate: number;
  minutesLate: number;
  stillIn: boolean;
  basePay: number;
  overtimePay: number;
  additions: number;
  additionsNote: string | null;
  deductions: number;
  deductionsNote: string | null;
  advanceOwed: number;
  advanceRecovered: number;
  recoverySet: boolean;
  gross: number;
  net: number;
  paid: number;
}

export interface PayrollApproval {
  approvedAt: string;
  approvedBy: string | null;
  gross: number;
  net: number;
  advancesRecovered: number;
  journalNo: number | null;
  reopenedAt: string | null;
  reopenedBy: string | null;
  reopenReason: string | null;
  reopenJournalNo: number | null;
}

export interface SalaryPayment {
  id: string;
  paidFrom: string;
  amount: number;
  paidOn: string;
  by: string | null;
  journalNo: number | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  people: { employeeId: string; name: string; amount: number }[];
}

export interface PayrollDetail {
  id: string;
  runNo: number;
  month: string;
  status: string;
  draftedAt: string | null;
  draftedBy: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  journalNo: number | null;
  /** A draft that still says what the hours and the pay say; null once approved. */
  current: boolean | null;
  monthOver: boolean;
  lines: PayrollLine[];
  approvals: PayrollApproval[];
  payments: SalaryPayment[];
}

export function payrollDetailFrom(v: unknown): PayrollDetail {
  const o = obj(v);
  return {
    id: str(o.id),
    runNo: num(o.run_no),
    month: str(o.month),
    status: str(o.status),
    draftedAt: strOrNull(o.drafted_at),
    draftedBy: strOrNull(o.drafted_by),
    approvedAt: strOrNull(o.approved_at),
    approvedBy: strOrNull(o.approved_by),
    journalNo: numOrNull(o.journal_no),
    current: o.current === null || o.current === undefined ? null : o.current === true,
    monthOver: o.month_over === true,
    lines: list(o.lines).map((l) => ({
      id: str(l.id),
      employeeId: str(l.employee_id),
      name: str(l.name),
      title: strOrNull(l.title),
      payBasis: PAY_BASES.includes(l.pay_basis as PayBasis) ? (l.pay_basis as PayBasis) : null,
      rate: numOrNull(l.rate),
      standardHours: num(l.standard_hours),
      overtimePercent: num(l.overtime_percent),
      daysInMonth: num(l.days_in_month),
      daysEmployed: num(l.days_employed),
      daysWorked: num(l.days_worked),
      minutesWorked: num(l.minutes_worked),
      overtimeMinutes: num(l.overtime_minutes),
      daysScheduled: num(l.days_scheduled),
      daysAbsent: num(l.days_absent),
      timesLate: num(l.times_late),
      minutesLate: num(l.minutes_late),
      stillIn: l.still_in === true,
      basePay: num(l.base_pay),
      overtimePay: num(l.overtime_pay),
      additions: num(l.additions),
      additionsNote: strOrNull(l.additions_note),
      deductions: num(l.deductions),
      deductionsNote: strOrNull(l.deductions_note),
      advanceOwed: num(l.advance_owed),
      advanceRecovered: num(l.advance_recovered),
      recoverySet: l.recovery_set === true,
      gross: num(l.gross),
      net: num(l.net),
      paid: num(l.paid),
    })),
    approvals: list(o.approvals).map((a) => ({
      approvedAt: str(a.approved_at),
      approvedBy: strOrNull(a.approved_by),
      gross: num(a.gross),
      net: num(a.net),
      advancesRecovered: num(a.advances_recovered),
      journalNo: numOrNull(a.journal_no),
      reopenedAt: strOrNull(a.reopened_at),
      reopenedBy: strOrNull(a.reopened_by),
      reopenReason: strOrNull(a.reopen_reason),
      reopenJournalNo: numOrNull(a.reopen_journal_no),
    })),
    payments: list(o.payments).map((p) => ({
      id: str(p.id),
      paidFrom: str(p.paid_from),
      amount: num(p.amount),
      paidOn: str(p.paid_on),
      by: strOrNull(p.by),
      journalNo: numOrNull(p.journal_no),
      cancelledAt: strOrNull(p.cancelled_at),
      cancelReason: strOrNull(p.cancel_reason),
      people: list(p.people).map((x) => ({
        employeeId: str(x.employee_id),
        name: str(x.name),
        amount: num(x.amount),
      })),
    })),
  };
}

/** What a payroll's lines add up to, and what is still to be paid. */
export function payrollTotals(lines: PayrollLine[]): {
  gross: number;
  net: number;
  recovered: number;
  paid: number;
  owed: number;
} {
  const sum = (f: (l: PayrollLine) => number) => lines.reduce((a, l) => a + f(l), 0);
  const net = sum((l) => l.net);
  const paid = sum((l) => l.paid);
  return {
    gross: sum((l) => l.gross),
    net,
    recovered: sum((l) => l.advanceRecovered),
    paid,
    owed: net - paid,
  };
}

export interface Advance {
  id: string;
  employeeId: string;
  name: string;
  amount: number;
  paidFrom: string;
  reason: string;
  givenOn: string;
  by: string | null;
  journalNo: number | null;
  cancelledAt: string | null;
  cancelReason: string | null;
}

export function advancesFrom(v: unknown): {
  advances: Advance[];
  owed: { employeeId: string; name: string; owed: number }[];
} {
  const o = obj(v);
  return {
    advances: list(o.advances).map((a) => ({
      id: str(a.id),
      employeeId: str(a.employee_id),
      name: str(a.name),
      amount: num(a.amount),
      paidFrom: str(a.paid_from),
      reason: str(a.reason),
      givenOn: str(a.given_on),
      by: strOrNull(a.by),
      journalNo: numOrNull(a.journal_no),
      cancelledAt: strOrNull(a.cancelled_at),
      cancelReason: strOrNull(a.cancel_reason),
    })),
    owed: list(o.owed).map((x) => ({
      employeeId: str(x.employee_id),
      name: str(x.name),
      owed: num(x.owed),
    })),
  };
}

export interface StaffReportPerson {
  employeeId: string;
  name: string;
  title: string | null;
  daysScheduled: number;
  daysWorked: number;
  minutes: number;
  overtimeMinutes: number;
  timesLate: number;
  minutesLate: number;
  timesEarly: number;
  minutesEarly: number;
  daysAbsent: number;
}

export interface StaffReport {
  from: string;
  to: string;
  people: StaffReportPerson[];
  /** What staff cost against sales, by month: only for those who see payroll. */
  labour: { month: string; cost: number; sales: number; percent: number | null }[] | null;
}

export function staffReportFrom(v: unknown): StaffReport {
  const o = obj(v);
  return {
    from: str(o.from),
    to: str(o.to),
    people: list(o.people).map((p) => ({
      employeeId: str(p.employee_id),
      name: str(p.name),
      title: strOrNull(p.title),
      daysScheduled: num(p.days_scheduled),
      daysWorked: num(p.days_worked),
      minutes: num(p.minutes),
      overtimeMinutes: num(p.overtime_minutes),
      timesLate: num(p.times_late),
      minutesLate: num(p.minutes_late),
      timesEarly: num(p.times_early),
      minutesEarly: num(p.minutes_early),
      daysAbsent: num(p.days_absent),
    })),
    labour: Array.isArray(o.labour)
      ? list(o.labour).map((m) => ({
          month: str(m.month),
          cost: num(m.cost),
          sales: num(m.sales),
          percent: numOrNull(m.percent),
        }))
      : null,
  };
}

const num = (v: unknown): number => {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const numOrNull = (v: unknown): number | null =>
  v === null || v === undefined || v === "" ? null : num(v);
const str = (v: unknown): string => (v === null || v === undefined ? "" : String(v));
const strOrNull = (v: unknown): string | null =>
  v === null || v === undefined || v === "" ? null : String(v);
const list = (v: unknown): Record<string, unknown>[] =>
  Array.isArray(v) ? (v as Record<string, unknown>[]) : [];
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

/** Every word this file gives a screen: each is a phrase in the books. */
export const STAFF_PHRASES: readonly string[] = [
  ...Object.values(PAY_BASIS_LABEL),
  ...Object.values(RATE_PER),
  ...Object.values(PAID_FROM_LABEL),
  ...Object.values(RUN_STATUS_LABEL),
  ...Object.values(SOURCE_LABEL),
];
