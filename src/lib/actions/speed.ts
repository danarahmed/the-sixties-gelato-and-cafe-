"use server";
/**
 * The Speed page (plan 8, 0100), for the system's administrators: how long
 * the app takes to reach the database, and each of the slow screens' calls,
 * measured from the app as the person signed in; and the measurement kept, so
 * it can be sent.
 */
import { z } from "zod";
import { callRpc, parse, refresh, type ActionResult } from "@/lib/db/rpc";
import { db } from "@/lib/db/client";
import { isSystemAdmin, type SpeedCall } from "@/lib/db/speed";
import { getSession } from "@/lib/auth/session";
import { businessToday } from "@/lib/dates";

/** The calls the slow screens make (plan 8's measurements), by the name shown. */
const CALLS: { name: string; fn: string; args: (day: string) => Record<string, unknown> }[] = [
  { name: "The alerts (dashboard)", fn: "current_alerts", args: () => ({}) },
  { name: "The daily brief (dashboard)", fn: "daily_brief", args: (day) => ({ p_day: day }) },
  { name: "Today's figures (dashboard)", fn: "dashboard_summary", args: (day) => ({ p_day: day }) },
  {
    name: "The day's sales (Reports)",
    fn: "report_daily_sales",
    args: (day) => ({ p_from: day, p_to: day, p_location: null }),
  },
  { name: "The till's menu", fn: "pos_catalogue", args: () => ({ p_location: null }) },
  {
    name: "The reconciliation (dashboard)",
    fn: "report_reconciliation",
    args: (day) => ({ p_as_of: day }),
  },
  { name: "What it costs to make (Menu)", fn: "menu_costing", args: () => ({}) },
];

export async function measureDatabaseAction(): Promise<
  ActionResult<{ databaseMs: number | null; calls: SpeedCall[] }>
> {
  if (!(await isSystemAdmin()))
    return { ok: false, error: "Only the system's administrators see this" };
  const session = await getSession();
  const day = businessToday(session.profile?.timezone ?? "Asia/Baghdad");
  const c = await db();
  // The trip to the database and back, the fastest of three (the first wakes it).
  const trips: number[] = [];
  for (let i = 0; i < 3; i++) {
    const t0 = performance.now();
    const r = await c.rpc("speed_ping");
    if (!r.error) trips.push(Math.round(performance.now() - t0));
  }
  const calls: SpeedCall[] = [];
  for (const call of CALLS) {
    const t0 = performance.now();
    const r = await c.rpc(call.fn, call.args(day));
    calls.push({ name: call.name, ms: r.error ? null : Math.round(performance.now() - t0) });
  }
  return {
    ok: true,
    data: { databaseMs: trips.length ? Math.min(...trips) : null, calls },
  };
}

const sampleInput = z.object({
  deviceMs: z.number().int().min(0).max(600000).nullable(),
  databaseMs: z.number().int().min(0).max(600000).nullable(),
  calls: z
    .array(
      z.object({ name: z.string().max(80), ms: z.number().int().min(0).max(600000).nullable() }),
    )
    .max(40),
  agent: z.string().max(120).nullable(),
  note: z.string().max(300, "A note is at most 300 letters").nullable(),
});

export async function saveSpeedSampleAction(
  input: z.input<typeof sampleInput>,
): Promise<ActionResult<{ id: string }>> {
  const v = parse(sampleInput, input);
  if (!v.ok) return v;
  const r = await callRpc<string>("save_speed_sample", {
    p_device_ms: v.data.deviceMs,
    p_database_ms: v.data.databaseMs,
    p_calls: v.data.calls,
    p_agent: v.data.agent,
    p_note: v.data.note,
  });
  if (!r.ok) return r;
  refresh("/admin/speed");
  return { ok: true, data: { id: String(r.data) } };
}
