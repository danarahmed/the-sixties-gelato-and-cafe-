"use server";
/** Sale days (0106): set up, changed before they begin, and stopped, by whoever keeps the settings. */
import { z } from "zod";
import { callRpc, parse, refresh, type ActionResult } from "@/lib/db/rpc";
import { day, id, text } from "@/lib/validation";

const time = z
  .string()
  .regex(/^\d{2}:\d{2}$/, "Choose the hours, from and to, on the same day")
  .nullable();

const saleDayInput = z.object({
  id: id("a sale day").nullable(),
  name: text("Name", 80),
  percent: z
    .number({ message: "A sale day takes from 1% to 90% off" })
    .gt(0, "A sale day takes from 1% to 90% off")
    .max(90, "A sale day takes from 1% to 90% off"),
  startsOn: day("From"),
  endsOn: day("To"),
  fromTime: time,
  toTime: time,
  excluded: z.array(id("a category")).max(100),
});

const PATHS = ["/settings", "/pos", "/reports/sale-days"];

export async function saveSaleDayAction(
  input: z.input<typeof saleDayInput>,
): Promise<ActionResult<{ id: string }>> {
  const v = parse(saleDayInput, input);
  if (!v.ok) return v;
  const r = await callRpc<{ id: string }>("save_sale_day", {
    p_id: v.data.id,
    p_name: v.data.name,
    p_percent: v.data.percent,
    p_starts_on: v.data.startsOn,
    p_ends_on: v.data.endsOn,
    p_from_time: v.data.fromTime,
    p_to_time: v.data.toTime,
    p_excluded: v.data.excluded,
  });
  if (!r.ok) return r;
  refresh(...PATHS);
  return { ok: true, data: { id: String(r.data.id) } };
}

export async function stopSaleDayAction(saleDayId: string): Promise<ActionResult<null>> {
  const v = parse(z.object({ id: id("a sale day") }), { id: saleDayId });
  if (!v.ok) return v;
  const r = await callRpc("stop_sale_day", { p_id: v.data.id });
  if (!r.ok) return r;
  refresh(...PATHS);
  return { ok: true, data: null };
}
