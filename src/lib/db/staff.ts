import "server-only";
/**
 * Who works here, the schedule, their hours, payrolls and advances (0049). All
 * from database functions that check the person's permission: pay comes back
 * only to those who see payroll.
 */
import { db, one, rows, str } from "./client";
import {
  advancesFrom,
  attendanceFrom,
  clockBoardFrom,
  payrollDetailFrom,
  payrollRunsFrom,
  scheduleFrom,
  staffFrom,
  staffReportFrom,
  type Advance,
  type AttendanceDay,
  type AttendanceRecord,
  type ClockPerson,
  type PayrollDetail,
  type PayrollRunRow,
  type Schedule,
  type StaffMember,
  type StaffReport,
} from "@/lib/staff";

export async function getStaff(): Promise<StaffMember[]> {
  const c = await db();
  return staffFrom(one(await c.rpc("staff_list"), "the people who work here"));
}

export async function getSchedule(
  from: string,
  to: string,
  locationId: string | null,
): Promise<Schedule> {
  const c = await db();
  return scheduleFrom(
    one(
      await c.rpc("staff_schedule", { p_from: from, p_to: to, p_location: locationId }),
      "the schedule",
    ),
  );
}

export async function getAttendance(
  from: string,
  to: string,
  employeeId: string | null = null,
): Promise<{ records: AttendanceRecord[]; days: AttendanceDay[] }> {
  const c = await db();
  return attendanceFrom(
    one(
      await c.rpc("attendance_list", { p_from: from, p_to: to, p_employee: employeeId }),
      "the records of hours",
    ),
  );
}

/** Who clocks at this till, and who is in (for the till). */
export async function getClockBoard(): Promise<ClockPerson[]> {
  const c = await db();
  return clockBoardFrom(one(await c.rpc("clock_board", { p_location: null }), "who clocks here"));
}

export async function getPayrollRuns(): Promise<PayrollRunRow[]> {
  const c = await db();
  return payrollRunsFrom(one(await c.rpc("payroll_runs"), "the payrolls"));
}

/** One payroll, for its own page; null when there is no such payroll. */
export async function getPayroll(runId: string): Promise<PayrollDetail | null> {
  const c = await db();
  const r = await c.rpc("payroll_detail", { p_run: runId });
  if (r.error && /Payroll not found/.test(r.error.message)) return null;
  const d = one(r, "the payroll");
  return d ? payrollDetailFrom(d) : null;
}

export async function getAdvances(): Promise<{
  advances: Advance[];
  owed: { employeeId: string; name: string; owed: number }[];
}> {
  const c = await db();
  return advancesFrom(one(await c.rpc("employee_advances", { p_employee: null }), "the advances"));
}

export async function getStaffReport(from: string, to: string): Promise<StaffReport> {
  const c = await db();
  return staffReportFrom(one(await c.rpc("report_staff", { p_from: from, p_to: to }), "the hours"));
}

/** The café's logins, to link to someone who works here. */
export async function getLogins(): Promise<{ id: string; name: string }[]> {
  const c = await db();
  return rows(
    await c.from("app_user").select("id,full_name").eq("is_active", true).order("full_name"),
    "the logins",
  ).map((u) => ({ id: str(u.id), name: str(u.full_name) }));
}
