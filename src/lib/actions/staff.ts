"use server";
/**
 * Who works here, their PINs, the schedule, and their hours (0049). Every
 * write is one database function that checks the person's permission and
 * says why it refuses; what someone is paid is set on Payroll's terms.
 */
import { z } from "zod";
import { badKey, callRpc, parse, refresh, type ActionResult } from "@/lib/db/rpc";
import {
  clockAnswerFrom,
  clockBoardFrom,
  PAY_BASES,
  type ClockAnswer,
  type ClockPerson,
} from "@/lib/staff";
import { day, id, optionalNonNegative, optionalText, positive, text } from "@/lib/validation";
import { tillForWrite } from "@/lib/place";
import { screenKey } from "@/lib/clockDevice";

const STAFF_PATHS = ["/staff", "/payroll", "/reports", "/pos"];

const employeeInput = z.object({
  employeeId: id("someone who works here").nullish(),
  name: text("Name", 80),
  phone: optionalText(40),
  title: optionalText(60),
  locationId: id("where they work"),
  hiredOn: day("Started on"),
  appUserId: id("a login").nullish(),
});

/** Someone who works here, added or their details changed (not their pay). */
export async function saveEmployeeAction(
  input: z.input<typeof employeeInput>,
  key: string,
): Promise<ActionResult<{ employeeId: string }>> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(employeeInput, input);
  if (!v.ok) return v;
  const r = await callRpc<Record<string, unknown>>("save_employee", {
    p_employee: v.data.employeeId ?? null,
    p_name: v.data.name,
    p_phone: v.data.phone,
    p_title: v.data.title,
    p_location: v.data.locationId,
    p_hired_on: v.data.hiredOn,
    p_app_user: v.data.appUserId ?? null,
    p_idempotency_key: key,
  });
  if (!r.ok) return r;
  refresh(...STAFF_PATHS);
  return { ok: true, data: { employeeId: String(r.data.employee_id ?? "") } };
}

const payInput = z.object({
  employeeId: id("someone who works here"),
  basis: z.enum(PAY_BASES, {
    message: "Choose how they are paid: by the month, the day or the hour",
  }),
  rate: positive("Their pay"),
  standardHours: positive("A day's hours"),
  overtimePercent: optionalNonNegative("Overtime"),
  reason: optionalText(300),
});

/** What someone is paid (those who run payroll). */
export async function setEmployeePayAction(
  input: z.input<typeof payInput>,
  key: string,
): Promise<ActionResult<{ employeeId: string }>> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(payInput, input);
  if (!v.ok) return v;
  const r = await callRpc<Record<string, unknown>>("set_employee_pay", {
    p_employee: v.data.employeeId,
    p_pay_basis: v.data.basis,
    p_rate: v.data.rate,
    p_standard_hours: v.data.standardHours,
    p_overtime_percent: v.data.overtimePercent,
    p_reason: v.data.reason,
    p_idempotency_key: key,
  });
  if (!r.ok) return r;
  refresh(...STAFF_PATHS);
  return { ok: true, data: { employeeId: String(r.data.employee_id ?? "") } };
}

const leftInput = z.object({
  employeeId: id("someone who works here"),
  /** Their last day; none: they work here again. */
  leftOn: day("Their last day").nullish(),
  reason: text("Why", 300),
});

/** Someone's last day, or back to working here. */
export async function setEmployeeLeftAction(
  input: z.input<typeof leftInput>,
  key: string,
): Promise<ActionResult<{ shiftsRemoved: number }>> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(leftInput, input);
  if (!v.ok) return v;
  const r = await callRpc<Record<string, unknown>>("set_employee_left", {
    p_employee: v.data.employeeId,
    p_left_on: v.data.leftOn ?? null,
    p_reason: v.data.reason,
    p_idempotency_key: key,
  });
  if (!r.ok) return r;
  refresh(...STAFF_PATHS);
  return { ok: true, data: { shiftsRemoved: Number(r.data.shifts_removed ?? 0) } };
}

const pinInput = z.object({
  employeeId: id("someone who works here"),
  pin: z.string().regex(/^[0-9]{4,8}$/, "A PIN is 4 to 8 digits"),
});

/** The PIN someone clocks with. */
export async function setClockPinAction(
  input: z.input<typeof pinInput>,
): Promise<ActionResult<null>> {
  const v = parse(pinInput, input);
  if (!v.ok) return v;
  const r = await callRpc<null>("set_clock_pin", {
    p_employee: v.data.employeeId,
    p_pin: v.data.pin,
  });
  if (!r.ok) return r;
  refresh("/staff", "/pos");
  return { ok: true, data: null };
}

const scheduleInput = z.object({
  locationId: id("a branch"),
  from: day("From"),
  to: day("To"),
  shifts: z
    .array(
      z.object({
        employeeId: id("someone who works here"),
        day: day("The day"),
        starts: z.string().regex(/^\d{2}:\d{2}$/, "Give the hours as 08:00 to 16:00"),
        ends: z.string().regex(/^\d{2}:\d{2}$/, "Give the hours as 08:00 to 16:00"),
        note: optionalText(200),
      }),
    )
    .max(500, "Save the schedule a week at a time"),
});

/** The hours at a branch in the dates, replacing what was there. */
export async function saveScheduleAction(
  input: z.input<typeof scheduleInput>,
  key: string,
): Promise<ActionResult<{ shifts: number }>> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(scheduleInput, input);
  if (!v.ok) return v;
  const r = await callRpc<Record<string, unknown>>("save_schedule", {
    p_location: v.data.locationId,
    p_from: v.data.from,
    p_to: v.data.to,
    p_shifts: v.data.shifts.map((s) => ({
      employee_id: s.employeeId,
      day: s.day,
      starts: s.starts,
      ends: s.ends,
      note: s.note,
    })),
    p_idempotency_key: key,
  });
  if (!r.ok) return r;
  refresh("/staff", "/pos", "/reports");
  return { ok: true, data: { shifts: Number(r.data.shifts ?? 0) } };
}

/** Who clocks at this till's branch (0055), and who is in. */
export async function clockBoardAction(): Promise<ActionResult<ClockPerson[]>> {
  const r = await callRpc<unknown>("clock_board", { p_location: await tillForWrite() });
  if (!r.ok) return r;
  return { ok: true, data: clockBoardFrom(r.data) };
}

const clockInput = z.object({
  employeeId: id("someone who works here"),
  pin: z.string().regex(/^[0-9]{4,8}$/, "A PIN is 4 to 8 digits"),
  direction: z.enum(["in", "out"], { message: "Clock in, or out" }),
});

/**
 * Clocking in or out at the till, with a name and a PIN. A wrong PIN is an
 * answer, not a failure: it is counted, and the person is told. The till says
 * which clock screen it is, if it is one (0068): once the café has one, the
 * till clocks only on a clock screen.
 */
export async function clockAction(
  input: z.input<typeof clockInput>,
  key: string,
): Promise<ActionResult<ClockAnswer>> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(clockInput, input);
  if (!v.ok) return v;
  const r =
    v.data.direction === "in"
      ? await callRpc<unknown>("clock_in", {
          p_employee: v.data.employeeId,
          p_pin: v.data.pin,
          p_location: await tillForWrite(),
          p_screen: await screenKey(),
          p_idempotency_key: key,
        })
      : await callRpc<unknown>("clock_out", {
          p_employee: v.data.employeeId,
          p_pin: v.data.pin,
          p_screen: await screenKey(),
          p_idempotency_key: key,
        });
  if (!r.ok) return r;
  const a = clockAnswerFrom(r.data);
  if (a.ok) refresh("/staff");
  return { ok: true, data: a };
}

const hoursInput = z.object({
  clockIn: z.string().datetime({ offset: true, message: "Say when they clocked in" }),
  clockOut: z.string().datetime({ offset: true, message: "Say when they clocked out" }).nullish(),
  reason: text("Why", 300),
});

/** A record of hours corrected, with why. */
export async function correctAttendanceAction(
  input: z.input<typeof hoursInput> & { attendanceId: string },
  key: string,
): Promise<ActionResult<null>> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(hoursInput.extend({ attendanceId: id("a record of hours") }), input);
  if (!v.ok) return v;
  const r = await callRpc<unknown>("correct_attendance", {
    p_attendance: v.data.attendanceId,
    p_clock_in: v.data.clockIn,
    p_clock_out: v.data.clockOut ?? null,
    p_reason: v.data.reason,
    p_idempotency_key: key,
  });
  if (!r.ok) return r;
  refresh(...STAFF_PATHS);
  return { ok: true, data: null };
}

/** Hours nobody clocked, added with why. */
export async function addAttendanceAction(
  input: z.input<typeof hoursInput> & { employeeId: string },
  key: string,
): Promise<ActionResult<null>> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(hoursInput.extend({ employeeId: id("someone who works here") }), input);
  if (!v.ok) return v;
  const r = await callRpc<unknown>("add_attendance", {
    p_employee: v.data.employeeId,
    p_clock_in: v.data.clockIn,
    p_clock_out: v.data.clockOut ?? null,
    p_reason: v.data.reason,
    p_location: null,
    p_idempotency_key: key,
  });
  if (!r.ok) return r;
  refresh(...STAFF_PATHS);
  return { ok: true, data: null };
}

const cancelInput = z.object({
  attendanceId: id("a record of hours"),
  reason: text("Why", 300),
});

/** A record of hours that should not be there, cancelled with why. */
export async function cancelAttendanceAction(
  input: z.input<typeof cancelInput>,
  key: string,
): Promise<ActionResult<null>> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(cancelInput, input);
  if (!v.ok) return v;
  const r = await callRpc<unknown>("cancel_attendance", {
    p_attendance: v.data.attendanceId,
    p_reason: v.data.reason,
    p_idempotency_key: key,
  });
  if (!r.ok) return r;
  refresh(...STAFF_PATHS);
  return { ok: true, data: null };
}
