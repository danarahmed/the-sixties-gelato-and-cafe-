import "server-only";
/**
 * The café's rules (0040, release O): each rule, every row that applies (who
 * set it, when and why, or the default), and the last changes. The database
 * checks the person may manage the settings.
 */
import { db, num, one, rows, str, strOrNull } from "./client";
import { parseBusinessRules, type BusinessRules } from "@/lib/rules";

export async function getBusinessRules(): Promise<BusinessRules> {
  const c = await db();
  return parseBusinessRules(one(await c.rpc("list_business_rules"), "the rules"));
}

/** A loss saved to wait for a manager's approval (0040). */
export interface LossWaiting {
  movementId: string;
  at: string;
  itemId: string;
  item: string;
  kind: string;
  qty: number;
  unit: string;
  /** Only for those who see costs. */
  value: number | null;
  reason: string | null;
  recordedById: string | null;
  recordedBy: string | null;
}

/** The losses waiting for a manager, oldest first (waste.approve). */
export async function getLossesWaiting(): Promise<LossWaiting[]> {
  const c = await db();
  return rows(await c.rpc("losses_waiting"), "the losses waiting for approval").map((r) => ({
    movementId: str(r.movement_id),
    at: str(r.at),
    itemId: str(r.item_id),
    item: str(r.item),
    kind: str(r.kind),
    qty: num(r.qty),
    unit: str(r.unit),
    value: r.value == null ? null : num(r.value),
    reason: strOrNull(r.reason),
    recordedById: strOrNull(r.recorded_by_id),
    recordedBy: strOrNull(r.recorded_by),
  }));
}
