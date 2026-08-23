/**
 * Exact decimal money arithmetic.
 *
 * ACCOUNTING RULE: money is NEVER represented as a JavaScript floating-point
 * number. All monetary values flow through `Decimal` (decimal.js), and the
 * results are rounded only at explicit boundaries using banker's rounding
 * (ROUND_HALF_EVEN) so that repeated rounding does not accumulate bias.
 *
 * A currency carries a `decimalPlaces` scale so the same code serves IQD
 * (0 decimals — integer dinar) and, say, USD (2 decimals). Precision is a
 * property of the currency, configured per business.
 */
import Decimal from "decimal.js";

// A wide working precision; values are only quantized at explicit boundaries.
Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_EVEN });

export interface Currency {
  /** ISO-ish code, e.g. "IQD", "USD". */
  readonly code: string;
  /** Number of fractional digits used for display and settlement, e.g. IQD=0. */
  readonly decimalPlaces: number;
  /** Symbol for display, e.g. "IQD", "$". */
  readonly symbol: string;
}

export const IQD: Currency = { code: "IQD", decimalPlaces: 0, symbol: "IQD" };
export const USD: Currency = { code: "USD", decimalPlaces: 2, symbol: "$" };

export type MoneyInput = Money | Decimal | number | string;

/**
 * An immutable monetary amount in a specific currency.
 *
 * Amounts are stored at full working precision internally; `quantize()`
 * applies the currency scale (banker's rounding) at a boundary such as a
 * receipt total, a journal line, or a settlement figure.
 */
export class Money {
  private readonly amount: Decimal;
  readonly currency: Currency;

  private constructor(amount: Decimal, currency: Currency) {
    this.amount = amount;
    this.currency = currency;
  }

  static of(value: MoneyInput, currency: Currency): Money {
    if (value instanceof Money) {
      Money.assertSameCurrency(value.currency, currency);
      return new Money(value.amount, currency);
    }
    return new Money(new Decimal(value), currency);
  }

  static zero(currency: Currency): Money {
    return new Money(new Decimal(0), currency);
  }

  private static assertSameCurrency(a: Currency, b: Currency): void {
    if (a.code !== b.code) {
      throw new Error(
        `Currency mismatch: cannot combine ${a.code} with ${b.code}. Convert explicitly at a defined FX rate first.`,
      );
    }
  }

  private wrap(amount: Decimal): Money {
    return new Money(amount, this.currency);
  }

  private toDecimal(other: MoneyInput): Decimal {
    if (other instanceof Money) {
      Money.assertSameCurrency(this.currency, other.currency);
      return other.amount;
    }
    return new Decimal(other);
  }

  add(other: MoneyInput): Money {
    return this.wrap(this.amount.plus(this.toDecimal(other)));
  }

  subtract(other: MoneyInput): Money {
    return this.wrap(this.amount.minus(this.toDecimal(other)));
  }

  /** Multiply by a dimensionless factor (e.g. a quantity or a percentage as a fraction). */
  multiply(factor: Decimal | number | string): Money {
    return this.wrap(this.amount.times(new Decimal(factor)));
  }

  /** Divide by a dimensionless divisor. Throws on divide-by-zero. */
  divide(divisor: Decimal | number | string): Money {
    const d = new Decimal(divisor);
    if (d.isZero()) throw new Error("Division by zero in Money.divide");
    return this.wrap(this.amount.dividedBy(d));
  }

  negate(): Money {
    return this.wrap(this.amount.negated());
  }

  abs(): Money {
    return this.wrap(this.amount.abs());
  }

  /** Apply the currency's scale using banker's rounding. Use at output boundaries. */
  quantize(): Money {
    return this.wrap(
      this.amount.toDecimalPlaces(this.currency.decimalPlaces, Decimal.ROUND_HALF_EVEN),
    );
  }

  isZero(): boolean {
    return this.amount.isZero();
  }

  isNegative(): boolean {
    return this.amount.isNegative();
  }

  isPositive(): boolean {
    return this.amount.greaterThan(0);
  }

  equals(other: MoneyInput): boolean {
    return this.amount.equals(this.toDecimal(other));
  }

  greaterThan(other: MoneyInput): boolean {
    return this.amount.greaterThan(this.toDecimal(other));
  }

  lessThan(other: MoneyInput): boolean {
    return this.amount.lessThan(this.toDecimal(other));
  }

  /** Raw decimal value (full precision). Prefer typed operations over this. */
  toDecimalValue(): Decimal {
    return this.amount;
  }

  /** Quantized numeric string for storage/serialization, e.g. "1500" or "3.50". */
  toStorageString(): string {
    return this.quantize().amount.toFixed(this.currency.decimalPlaces);
  }

  /** Human string with symbol, e.g. "1,500 IQD". */
  format(locale = "en-US"): string {
    const n = Number(this.quantize().amount.toFixed(this.currency.decimalPlaces));
    const formatted = new Intl.NumberFormat(locale, {
      minimumFractionDigits: this.currency.decimalPlaces,
      maximumFractionDigits: this.currency.decimalPlaces,
    }).format(n);
    return `${formatted} ${this.currency.symbol}`;
  }

  static sum(items: Money[], currency: Currency): Money {
    return items.reduce((acc, m) => acc.add(m), Money.zero(currency));
  }
}
