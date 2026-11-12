"use server";
/**
 * Security fixes (0099): where a place is, for clocking from a phone; the
 * till unlocked with the person's PIN; a screen that failed, and the device a
 * person signed in on, noted for the owner's alerts.
 */
import { z } from "zod";
import { callRpc, parse, refresh, type ActionResult } from "@/lib/db/rpc";
import { id } from "@/lib/validation";

const spotInput = z.object({
  placeId: id("the place"),
  lat: z.number().min(-90).max(90).nullable(),
  lng: z.number().min(-180).max(180).nullable(),
  radius: z
    .number()
    .int()
    .min(20, "How near is 20 to 2,000 metres")
    .max(2000, "How near is 20 to 2,000 metres"),
});

export async function setClockSpotAction(
  input: z.input<typeof spotInput>,
): Promise<ActionResult<{ lat: number | null; lng: number | null; radius: number }>> {
  const v = parse(spotInput, input);
  if (!v.ok) return v;
  const r = await callRpc<Record<string, unknown>>("set_place_clock_spot", {
    p_place: v.data.placeId,
    p_lat: v.data.lat,
    p_lng: v.data.lng,
    p_radius: v.data.radius,
  });
  if (!r.ok) return r;
  refresh("/settings");
  return { ok: true, data: { lat: v.data.lat, lng: v.data.lng, radius: v.data.radius } };
}

export async function unlockTillAction(
  pin: string,
): Promise<ActionResult<{ ok: boolean; error: string | null }>> {
  if (typeof pin !== "string" || !/^\d{4,8}$/.test(pin))
    return { ok: true, data: { ok: false, error: "That PIN is not right" } };
  const r = await callRpc<Record<string, unknown>>("unlock_till", { p_pin: pin });
  if (!r.ok) return r;
  return {
    ok: true,
    data: { ok: r.data.ok === true, error: r.data.error ? String(r.data.error) : null },
  };
}

/** A screen that failed, noted for the owner (0099): on Reports → Where people get stuck. */
export async function noteScreenErrorAction(path: string, message: string): Promise<void> {
  if (typeof path !== "string" || !/^\/[A-Za-z0-9/_-]{0,80}$/.test(path)) return;
  const said = typeof message === "string" ? message.slice(0, 300) : "";
  await callRpc("note_stuck", { p_path: path, p_kind: "error", p_message: said || null });
}

/** The device this person signed in on (0099): a new one is an alert for the owner. */
export async function noteDeviceAction(key: string, agent: string): Promise<void> {
  if (typeof key !== "string" || key.length < 16 || key.length > 200) return;
  await callRpc("note_device", {
    p_key: key,
    p_agent: typeof agent === "string" ? agent.slice(0, 120) : null,
  });
}
