/** Unit tests for the money, unit-conversion, WAC and accounting primitives. */
import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import { IQD, USD, Money } from "../src/domain/money/money.js";
import { Quantity, UnitSystem, type UnitDefinition } from "../src/domain/units/units.js";
import {
  emptyWacState,
  applyReceipt,
  applyIssue,
  averageUnitCost,
  landedUnitCost,
} from "../src/domain/costing/wac.js";
import {
  assertBalanced,
  isBalanced,
  reverseEntry,
  type JournalEntry,
} from "../src/domain/accounting/journal.js";

describe("Money", () => {
  it("does not use floating point (0.1 + 0.2 handling)", () => {
    const sum = Money.of("0.1", USD).add("0.2");
    expect(sum.toStorageString()).toBe("0.30");
  });

  it("quantizes IQD to whole dinar with banker's rounding", () => {
    expect(Money.of("1500.5", IQD).toStorageString()).toBe("1500"); // 1500.5 -> even 1500
    expect(Money.of("1501.5", IQD).toStorageString()).toBe("1502"); // -> even 1502
  });

  it("refuses to mix currencies", () => {
    expect(() => Money.of(1, IQD).add(Money.of(1, USD))).toThrow(/Currency mismatch/);
  });

  it("throws on divide by zero", () => {
    expect(() => Money.of(10, IQD).divide(0)).toThrow(/Division by zero/);
  });
});

describe("Unit conversions", () => {
  const milk = new UnitSystem("ml", [
    { code: "ml", dimension: "volume", factorToBase: "1", label: "ml" },
    { code: "L", dimension: "volume", factorToBase: "1000", label: "L" },
    { code: "case_12x1L", dimension: "volume", factorToBase: "12000", label: "case" },
  ]);

  it("purchases in case, consumes in ml", () => {
    expect(Quantity.of(1, "case_12x1L").toBase(milk).value.toString()).toBe("12000");
    expect(Quantity.of(12000, "ml").convertTo("case_12x1L", milk).value.toString()).toBe("1");
  });

  it("rejects a base unit whose factor is not 1", () => {
    const bad: UnitDefinition[] = [{ code: "x", dimension: "mass", factorToBase: "2", label: "x" }];
    expect(() => new UnitSystem("x", bad)).toThrow(/factorToBase = 1/);
  });

  it("rejects mixing dimensions", () => {
    expect(
      () =>
        new UnitSystem("g", [
          { code: "g", dimension: "mass", factorToBase: "1", label: "g" },
          { code: "ml", dimension: "volume", factorToBase: "1", label: "ml" },
        ]),
    ).toThrow(/does not match base dimension/);
  });

  it("refuses to add quantities in different units", () => {
    expect(() => Quantity.of(1, "L").add(Quantity.of(1, "ml"))).toThrow(/different units/);
  });
});

describe("Moving weighted-average cost", () => {
  it("recomputes the average across two receipts and values an issue at that average", () => {
    let s = emptyWacState(IQD);
    s = applyReceipt(s, { quantityBase: 100, value: Money.of(1000, IQD) }); // 10/unit
    s = applyReceipt(s, { quantityBase: 100, value: Money.of(3000, IQD) }); // now 200 @ 20 avg
    expect(averageUnitCost(s).toStorageString()).toBe("20");

    const issue = applyIssue(s, 50);
    expect(issue.unitCostSnapshot.toStorageString()).toBe("20");
    expect(issue.issuedValue.toStorageString()).toBe("1000"); // 50 * 20
    expect(issue.state.quantityBase.toString()).toBe("150");
    // Average is unchanged by an issue.
    expect(averageUnitCost(issue.state).toStorageString()).toBe("20");
  });

  it("folds landed costs (freight up, rebate down) into unit cost", () => {
    const { unitCost, landedValue } = landedUnitCost({
      quantityBase: 100,
      goodsValue: Money.of(1000, IQD),
      allocatedFreight: Money.of(200, IQD),
      allocatedRebate: Money.of(100, IQD),
    });
    expect(landedValue.toStorageString()).toBe("1100");
    expect(unitCost.toStorageString()).toBe("11");
  });
});

describe("Double-entry journal", () => {
  const entry: JournalEntry = {
    id: "je1",
    occurredAt: "2026-08-23T09:00:00.000Z",
    description: "Cash sale",
    lines: [
      { accountCode: "1000-cash", debit: Money.of(5000, IQD), credit: Money.zero(IQD) },
      { accountCode: "4000-sales", debit: Money.zero(IQD), credit: Money.of(5000, IQD) },
    ],
  };

  it("accepts a balanced entry and detects an unbalanced one", () => {
    expect(isBalanced(entry, IQD)).toBe(true);
    const bad: JournalEntry = {
      ...entry,
      lines: [
        entry.lines[0]!,
        { accountCode: "4000-sales", debit: Money.zero(IQD), credit: Money.of(4000, IQD) },
      ],
    };
    expect(isBalanced(bad, IQD)).toBe(false);
    expect(() => assertBalanced(bad, IQD)).toThrow(/Unbalanced/);
  });

  it("reverses an entry by swapping debits and credits", () => {
    const rev = reverseEntry(entry, { id: "je1r", occurredAt: entry.occurredAt, reason: "error" });
    expect(rev.lines[0]!.credit.toStorageString()).toBe("5000");
    expect(rev.lines[0]!.debit.toStorageString()).toBe("0");
    expect(isBalanced(rev, IQD)).toBe(true);
  });
});
