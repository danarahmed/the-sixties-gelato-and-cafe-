/**
 * Exact-decimal quantities and explicit, validated unit conversions.
 *
 * INVENTORY RULE: every item has exactly one immutable BASE UNIT. All ledger
 * movements and stock levels are stored in the base unit. Purchasing,
 * consumption, and counting may happen in ALTERNATE UNITS (carton, case,
 * kilogram, bottle...) which convert to the base unit by an explicit,
 * test-covered factor. There is no implicit unit magic anywhere.
 *
 * Examples encoded by callers/seed data:
 *   - Straw:  base "each";  carton = 1000 each
 *   - Coffee: base "g";     kg = 1000 g
 *   - Milk:   base "ml";    bottle(1L) = 1000 ml; case = 12 bottles = 12000 ml
 *   - Syrup:  base "ml";    bottle(700ml) = 700 ml
 */
import Decimal from "decimal.js";

/** A physical dimension. Conversions are only valid within the same dimension. */
export type Dimension = "count" | "mass" | "volume";

export interface UnitDefinition {
  /** Unique code, e.g. "each", "g", "ml", "carton_1000", "case_12x1L". */
  readonly code: string;
  readonly dimension: Dimension;
  /**
   * How many BASE units one of THIS unit equals, as an exact decimal string.
   * The base unit itself has factorToBase = "1".
   */
  readonly factorToBase: string;
  /** Human label, e.g. "Carton (1,000 straws)". */
  readonly label: string;
}

/**
 * The set of units available for a single item, all sharing one base unit.
 * Immutable and validated on construction.
 */
export class UnitSystem {
  readonly baseUnit: UnitDefinition;
  private readonly byCode: Map<string, UnitDefinition>;

  constructor(baseUnitCode: string, units: UnitDefinition[]) {
    this.byCode = new Map();
    for (const u of units) {
      if (this.byCode.has(u.code)) {
        throw new Error(`Duplicate unit code "${u.code}" in unit system`);
      }
      if (new Decimal(u.factorToBase).lessThanOrEqualTo(0)) {
        throw new Error(`Unit "${u.code}" must have a positive factorToBase`);
      }
      this.byCode.set(u.code, u);
    }
    const base = this.byCode.get(baseUnitCode);
    if (!base) throw new Error(`Base unit "${baseUnitCode}" not found in unit system`);
    if (!new Decimal(base.factorToBase).equals(1)) {
      throw new Error(`Base unit "${baseUnitCode}" must have factorToBase = 1`);
    }
    // All units must share the base unit's dimension.
    for (const u of units) {
      if (u.dimension !== base.dimension) {
        throw new Error(
          `Unit "${u.code}" (${u.dimension}) does not match base dimension ${base.dimension}`,
        );
      }
    }
    this.baseUnit = base;
  }

  unit(code: string): UnitDefinition {
    const u = this.byCode.get(code);
    if (!u) throw new Error(`Unknown unit "${code}" for this item`);
    return u;
  }

  has(code: string): boolean {
    return this.byCode.has(code);
  }
}

/** An immutable amount expressed in a specific unit of a specific unit system. */
export class Quantity {
  readonly value: Decimal;
  readonly unitCode: string;

  private constructor(value: Decimal, unitCode: string) {
    this.value = value;
    this.unitCode = unitCode;
  }

  static of(value: Decimal | number | string, unitCode: string): Quantity {
    return new Quantity(new Decimal(value), unitCode);
  }

  /** Convert this quantity into the item's base unit (exact). */
  toBase(system: UnitSystem): Quantity {
    const unit = system.unit(this.unitCode);
    const baseValue = this.value.times(unit.factorToBase);
    return new Quantity(baseValue, system.baseUnit.code);
  }

  /** Convert this quantity into any target unit of the same item (exact). */
  convertTo(targetUnitCode: string, system: UnitSystem): Quantity {
    const base = this.toBase(system);
    const target = system.unit(targetUnitCode);
    const targetValue = base.value.dividedBy(target.factorToBase);
    return new Quantity(targetValue, targetUnitCode);
  }

  add(other: Quantity): Quantity {
    if (other.unitCode !== this.unitCode) {
      throw new Error(
        `Cannot add quantities in different units (${this.unitCode} vs ${other.unitCode}); convert first`,
      );
    }
    return new Quantity(this.value.plus(other.value), this.unitCode);
  }

  subtract(other: Quantity): Quantity {
    if (other.unitCode !== this.unitCode) {
      throw new Error(
        `Cannot subtract quantities in different units (${this.unitCode} vs ${other.unitCode}); convert first`,
      );
    }
    return new Quantity(this.value.minus(other.value), this.unitCode);
  }

  negate(): Quantity {
    return new Quantity(this.value.negated(), this.unitCode);
  }

  isNegative(): boolean {
    return this.value.isNegative();
  }

  equals(other: Quantity): boolean {
    return this.unitCode === other.unitCode && this.value.equals(other.value);
  }

  /** Round to a number of decimal places for display/storage (banker's rounding). */
  round(decimalPlaces: number): Quantity {
    return new Quantity(
      this.value.toDecimalPlaces(decimalPlaces, Decimal.ROUND_HALF_EVEN),
      this.unitCode,
    );
  }

  toString(): string {
    return `${this.value.toString()} ${this.unitCode}`;
  }
}
