/**
 * The permanent, append-only inventory-movement ledger.
 *
 * INVENTORY INTEGRITY RULE (core of the whole system):
 *   - There is NO editable "current stock" field anywhere.
 *   - Current stock for an item at a location is ALWAYS the signed sum of every
 *     movement in this ledger, expressed in the item's base unit.
 *   - Movements are never edited or deleted. A mistake is fixed by posting a
 *     REVERSAL or an ADJUSTMENT movement, preserving full history.
 *
 * Each movement carries a signed base-unit quantity: receipts are positive,
 * issues are negative. The `MOVEMENT_SIGN` table is the single source of truth
 * for direction, so callers pass an absolute quantity and a type.
 */
import Decimal from "decimal.js";

export type MovementType =
  | "opening_balance"
  | "purchase_receipt"
  | "supplier_return"
  | "production_consumption"
  | "production_output"
  | "sale_consumption"
  | "refund_return_to_stock"
  | "waste"
  | "spoilage"
  | "melt_evaporation"
  | "staff_consumption"
  | "complimentary"
  | "sampling"
  | "transfer_out"
  | "transfer_in"
  | "count_adjustment"
  | "manual_correction"
  | "damaged"
  | "expired"
  | "reversal";

/** +1 = increases stock, -1 = decreases stock. */
export const MOVEMENT_SIGN: Record<MovementType, 1 | -1> = {
  opening_balance: 1,
  purchase_receipt: 1,
  supplier_return: -1,
  production_consumption: -1,
  production_output: 1,
  sale_consumption: -1,
  refund_return_to_stock: 1,
  waste: -1,
  spoilage: -1,
  melt_evaporation: -1,
  staff_consumption: -1,
  complimentary: -1,
  sampling: -1,
  transfer_out: -1,
  transfer_in: 1,
  count_adjustment: 1, // sign carried by the (possibly negative) magnitude
  manual_correction: 1, // sign carried by the (possibly negative) magnitude
  damaged: -1,
  expired: -1,
  reversal: 1, // sign carried by the reversed magnitude
};

/** Movement types whose stored magnitude may itself be negative. */
const SIGNED_MAGNITUDE_TYPES: ReadonlySet<MovementType> = new Set<MovementType>([
  "count_adjustment",
  "manual_correction",
  "reversal",
]);

export interface InventoryMovement {
  readonly id: string;
  readonly itemId: string;
  readonly locationId: string;
  readonly type: MovementType;
  /**
   * Signed quantity in the item's BASE unit. For directional types this equals
   * absoluteMagnitude * MOVEMENT_SIGN[type]. For adjustment/correction/reversal
   * types it is stored already-signed.
   */
  readonly baseQuantitySigned: Decimal;
  /** Value of the movement in the business currency's storage string, if costed. */
  readonly valueStorage?: string;
  readonly lotId?: string;
  readonly referenceType?: string;
  readonly referenceId?: string;
  readonly employeeId?: string;
  readonly reason?: string;
  /** UTC ISO-8601 timestamp. */
  readonly occurredAt: string;
}

export interface NewMovementInput {
  id: string;
  itemId: string;
  locationId: string;
  type: MovementType;
  /**
   * Quantity in base units. For directional types pass a POSITIVE magnitude
   * (direction is applied from MOVEMENT_SIGN). For adjustment/correction/
   * reversal types pass the already-signed value (may be negative).
   */
  baseQuantity: Decimal | number | string;
  valueStorage?: string;
  lotId?: string;
  referenceType?: string;
  referenceId?: string;
  employeeId?: string;
  reason?: string;
  occurredAt: string;
}

/** Build a validated movement, applying the direction sign for directional types. */
export function createMovement(input: NewMovementInput): InventoryMovement {
  const magnitude = new Decimal(input.baseQuantity);
  let signed: Decimal;
  if (SIGNED_MAGNITUDE_TYPES.has(input.type)) {
    signed = magnitude; // caller supplies the sign
  } else {
    if (magnitude.isNegative()) {
      throw new Error(
        `Directional movement "${input.type}" requires a positive magnitude; use manual_correction for signed adjustments`,
      );
    }
    signed = magnitude.times(MOVEMENT_SIGN[input.type]);
  }
  const movement: InventoryMovement = {
    id: input.id,
    itemId: input.itemId,
    locationId: input.locationId,
    type: input.type,
    baseQuantitySigned: signed,
    occurredAt: input.occurredAt,
  };
  // Attach optional fields without introducing `undefined` keys.
  const withOptional: Record<string, unknown> = { ...movement };
  for (const key of [
    "valueStorage",
    "lotId",
    "referenceType",
    "referenceId",
    "employeeId",
    "reason",
  ] as const) {
    const v = input[key];
    if (v !== undefined) withOptional[key] = v;
  }
  return withOptional as unknown as InventoryMovement;
}

/**
 * Current stock (base units) for a single item+location, as the signed sum of
 * all its movements. Callers filter to the item/location; this sums whatever
 * it is given so it composes with any query source.
 */
export function currentStockBase(movements: readonly InventoryMovement[]): Decimal {
  return movements.reduce((acc, m) => acc.plus(m.baseQuantitySigned), new Decimal(0));
}

/** Stock grouped by `${itemId}::${locationId}`. */
export function stockByItemLocation(movements: readonly InventoryMovement[]): Map<string, Decimal> {
  const out = new Map<string, Decimal>();
  for (const m of movements) {
    const key = `${m.itemId}::${m.locationId}`;
    out.set(key, (out.get(key) ?? new Decimal(0)).plus(m.baseQuantitySigned));
  }
  return out;
}

/**
 * Reverse an existing movement: produces a new movement of type "reversal" that
 * negates the original's signed quantity. History is preserved; the original is
 * untouched.
 */
export function reverseMovement(
  original: InventoryMovement,
  meta: { id: string; occurredAt: string; employeeId?: string; reason: string },
): InventoryMovement {
  return createMovement({
    id: meta.id,
    itemId: original.itemId,
    locationId: original.locationId,
    type: "reversal",
    baseQuantity: original.baseQuantitySigned.negated(),
    referenceType: "movement",
    referenceId: original.id,
    occurredAt: meta.occurredAt,
    reason: meta.reason,
    ...(meta.employeeId !== undefined ? { employeeId: meta.employeeId } : {}),
  });
}
