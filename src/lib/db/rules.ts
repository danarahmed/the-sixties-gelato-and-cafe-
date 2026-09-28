import "server-only";
/**
 * The café's rules (0040, release O): each rule, every row that applies (who
 * set it, when and why, or the default), and the last changes. The database
 * checks the person may manage the settings.
 */
import { db, one, rows } from "./client";
import { parseBusinessRules, type BusinessRules } from "@/lib/rules";
import { lossesWaitingFrom, type LossWaiting } from "@/lib/losses";

export type { LossWaiting };

export async function getBusinessRules(): Promise<BusinessRules> {
  const c = await db();
  return parseBusinessRules(one(await c.rpc("list_business_rules"), "the rules"));
}

/** The losses waiting for a manager, oldest first (waste.approve): each whole (0048). */
export async function getLossesWaiting(): Promise<LossWaiting[]> {
  const c = await db();
  return lossesWaitingFrom(rows(await c.rpc("losses_waiting"), "the losses waiting for approval"));
}
