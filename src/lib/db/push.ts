import "server-only";
/**
 * Warnings on your phone (0072): whether they are on for the café, and on a
 * phone, read as the signed-in person. Null before 0072 is applied, so the
 * screens leave the warnings out rather than break.
 */
import { db } from "./client";

export interface PhoneWarnings {
  on: boolean;
  publicKey: string | null;
  /** The database has its timer and its calls out (pg_cron, pg_net). */
  canSend: boolean;
  mayReceive: boolean;
  mayTurnOn: boolean;
  turnedOnAt: string | null;
  /** How many phones get them: for whoever turns them on. */
  phones: number | null;
}

export function phoneWarningsFrom(v: unknown): PhoneWarnings {
  const o = (v ?? {}) as Record<string, unknown>;
  return {
    on: o.on === true,
    publicKey: typeof o.public_key === "string" ? o.public_key : null,
    canSend: o.can_send === true,
    mayReceive: o.may_receive === true,
    mayTurnOn: o.may_turn_on === true,
    turnedOnAt: typeof o.turned_on_at === "string" ? o.turned_on_at : null,
    phones: typeof o.phones === "number" ? o.phones : o.phones == null ? null : Number(o.phones),
  };
}

export async function getPhoneWarnings(): Promise<PhoneWarnings | null> {
  const c = await db();
  const r = await c.rpc("phone_warnings", {});
  if (r.error) return null;
  return phoneWarningsFrom(r.data);
}
