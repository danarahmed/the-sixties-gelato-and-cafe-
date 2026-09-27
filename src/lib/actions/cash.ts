"use server";
/**
 * The drawer in sessions (0036, release K). Each action is one database
 * function, keyed like every other write (0035): opening the drawer with a
 * count, closing it with a count (blind: the answer is the first place the
 * person counting sees what it should have held), handing it over, and a
 * manager's close of a session left open.
 */
import { z } from "zod";
import { badKey, callRpc, parse, refresh, type ActionResult } from "@/lib/db/rpc";
import { countResult, type CountResult } from "@/lib/cash";
import { id, nonNegative, optionalNonNegative, text } from "@/lib/validation";

const PATHS = [
  "/pos",
  "/sales",
  "/sales/sessions",
  "/journals",
  "/accounting",
  "/reports",
  "/dashboard",
];

/** The notes counted: the note's value → how many (whole notes). */
const notes = z
  .record(z.string().regex(/^\d+$/), z.number().int().nonnegative())
  .nullable()
  .optional();

const openInput = z.object({
  counted: nonNegative("Cash counted"),
  notes,
  /** A manager's float from the safe, put in after the count. */
  floatFromSafe: optionalNonNegative("Cash from the safe"),
});

/** Open the drawer, counting what is in it. */
export async function openSessionAction(
  input: z.input<typeof openInput>,
  key: string,
): Promise<ActionResult<CountResult>> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(openInput, input);
  if (!v.ok) return v;
  const r = await callRpc<Record<string, unknown>>("open_cash_session", {
    p_counted: v.data.counted,
    p_denominations: v.data.notes ?? null,
    p_float_from_safe: v.data.floatFromSafe,
    p_idempotency_key: key,
  });
  if (!r.ok) return r;
  refresh(...PATHS);
  return { ok: true, data: countResult(r.data) };
}

const closeInput = z.object({
  counted: nonNegative("Cash counted"),
  notes,
  /** What stays in the drawer for the next session; empty keeps it all. */
  left: optionalNonNegative("What stays in the drawer"),
  takeTo: z.enum(["safe", "bank"]).nullable(),
  /** A manager closing another's session names it; the till's own is the open one. */
  sessionId: id("a session").nullish(),
});

/** Close the drawer's session, counted blind. */
export async function closeSessionAction(
  input: z.input<typeof closeInput>,
  key: string,
): Promise<ActionResult<CountResult>> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(closeInput, input);
  if (!v.ok) return v;
  const r = await callRpc<Record<string, unknown>>("close_cash_session", {
    p_counted: v.data.counted,
    p_denominations: v.data.notes ?? null,
    p_left_in_drawer: v.data.left,
    p_take_to: v.data.takeTo,
    p_session: v.data.sessionId ?? null,
    p_idempotency_key: key,
  });
  if (!r.ok) return r;
  refresh(...PATHS);
  return { ok: true, data: countResult(r.data) };
}

const handOverInput = z.object({
  counted: nonNegative("Cash counted"),
  notes,
  left: optionalNonNegative("What stays in the drawer"),
  takeTo: z.enum(["safe", "bank"]).nullable(),
  to: id("the person taking the drawer"),
});

/** Close the session and open the next person's on what was left, in one step. */
export async function handOverAction(
  input: z.input<typeof handOverInput>,
  key: string,
): Promise<ActionResult<CountResult>> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(handOverInput, input);
  if (!v.ok) return v;
  const r = await callRpc<Record<string, unknown>>("hand_over_session", {
    p_counted: v.data.counted,
    p_to: v.data.to,
    p_denominations: v.data.notes ?? null,
    p_left_in_drawer: v.data.left,
    p_take_to: v.data.takeTo,
    p_idempotency_key: key,
  });
  if (!r.ok) return r;
  refresh(...PATHS);
  return { ok: true, data: countResult(r.data) };
}

const forceInput = z.object({
  sessionId: id("a session"),
  reason: text("Why it is closed", 300),
  /** Empty: closed without a count; the next opening count finds what it held. */
  counted: optionalNonNegative("Cash counted"),
  notes,
});

/** A manager closes a session left open, with a reason, counted or not. */
export async function forceCloseAction(
  input: z.input<typeof forceInput>,
  key: string,
): Promise<ActionResult<CountResult>> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(forceInput, input);
  if (!v.ok) return v;
  const r = await callRpc<Record<string, unknown>>("force_close_session", {
    p_session: v.data.sessionId,
    p_reason: v.data.reason,
    p_counted: v.data.counted,
    p_denominations: v.data.counted === null ? null : (v.data.notes ?? null),
    p_idempotency_key: key,
  });
  if (!r.ok) return r;
  refresh(...PATHS);
  return { ok: true, data: countResult(r.data) };
}
