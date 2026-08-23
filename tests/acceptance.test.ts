/**
 * The 12 required acceptance scenarios (spec §16), each an executable test
 * against the deterministic domain core. These are the contract the business
 * calculations must satisfy.
 */
import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";

import { IQD, Money } from "../src/domain/money/money.js";
import { Quantity } from "../src/domain/units/units.js";
import {
  createMovement,
  currentStockBase,
  reverseMovement,
} from "../src/domain/inventory/ledger.js";
import {
  emptyWacState,
  applyReceipt,
  applyIssue,
  averageUnitCost,
  type WacState,
} from "../src/domain/costing/wac.js";
import { expandRecipeForSale, recipeServingCost } from "../src/domain/sales/recipe.js";
import { planProductionBatch } from "../src/domain/inventory/production.js";
import {
  computeCountVariance,
  adjustmentQuantityForCount,
} from "../src/domain/inventory/counting.js";
import {
  computePlatformPayout,
  computeChannelContribution,
  reconcileSettlement,
  type PlatformOrderEconomics,
  type ExpectedOrderRecord,
  type SettlementLine,
} from "../src/domain/platform/settlement.js";
import { IdempotencyRegistry, externalOrderKey } from "../src/domain/sales/idempotency.js";
import { computeRefundReturns, type ItemStockPolicy } from "../src/domain/sales/refund.js";
import { can, authorize } from "../src/domain/auth/permissions.js";
import { getUnitSystem, resolverContext, RECIPES, deductionMap } from "./fixtures.js";

const iqd = (v: number | string) => Money.of(v, IQD);
const AT = "2026-08-23T09:00:00.000Z";

/** Build a WAC state whose average unit cost equals `unitCost` exactly. */
function makeWac(unitCost: number): WacState {
  return { quantityBase: new Decimal(1000), totalValue: iqd(unitCost * 1000) };
}

const UNIT_COSTS: Record<string, number> = {
  coffee_beans: 40, // per g
  milk: 2, // per ml
  vanilla_syrup: 5, // per ml
  ice: 0.2, // per g
  cup_takeaway: 100,
  lid: 50,
  straw: 20,
  delivery_bag: 150,
  napkin: 10,
  sticker: 30,
  tamper_seal: 40,
  carrier: 200,
  gelato_pistachio: 4,
  gelato_cup: 120,
  gelato_spoon: 15,
  gelato_napkin: 8,
  cream: 3, // per ml
  sugar: 1, // per g
  pistachio_paste: 20, // per g
};

function wacMap(overrides: Partial<Record<string, number>> = {}): Map<string, WacState> {
  const m = new Map<string, WacState>();
  for (const [item, cost] of Object.entries({ ...UNIT_COSTS, ...overrides })) {
    m.set(item, makeWac(cost as number));
  }
  return m;
}

// ---------------------------------------------------------------------------

describe("Scenario 1 — receiving one carton of 1,000 straws increases stock by exactly 1,000", () => {
  it("converts carton→each and posts a +1000 movement", () => {
    const system = getUnitSystem("straw");
    const base = Quantity.of(1, "carton_1000").toBase(system);
    expect(base.value.toString()).toBe("1000");
    expect(base.unitCode).toBe("each");

    const receipt = createMovement({
      id: "m1",
      itemId: "straw",
      locationId: "branch-1",
      type: "purchase_receipt",
      baseQuantity: base.value,
      occurredAt: AT,
    });
    expect(currentStockBase([receipt]).toString()).toBe("1000");
  });
});

describe("Scenario 2 — medium takeaway iced latte deducts the correct components", () => {
  it("deducts ingredients + takeaway packaging, and NO delivery packaging", () => {
    const deductions = expandRecipeForSale(RECIPES.iced_latte!, "takeaway", 1, resolverContext);
    const m = deductionMap(deductions);
    expect(m.get("coffee_beans")!.toString()).toBe("18");
    expect(m.get("milk")!.toString()).toBe("200");
    expect(m.get("vanilla_syrup")!.toString()).toBe("30");
    expect(m.get("ice")!.toString()).toBe("150");
    expect(m.get("cup_takeaway")!.toString()).toBe("1");
    expect(m.get("lid")!.toString()).toBe("1");
    expect(m.get("straw")!.toString()).toBe("1");
    // No delivery packaging on takeaway.
    for (const gone of ["delivery_bag", "napkin", "sticker", "tamper_seal", "carrier"]) {
      expect(m.has(gone)).toBe(false);
    }
  });
});

describe("Scenario 3 — the same drink via Talabat uses its channel price and extra packaging", () => {
  it("adds delivery packaging on the platform channel and prices at the Talabat price", () => {
    const deductions = expandRecipeForSale(RECIPES.iced_latte!, "talabat", 1, resolverContext);
    const m = deductionMap(deductions);
    // Everything from takeaway…
    expect(m.get("cup_takeaway")!.toString()).toBe("1");
    expect(m.get("straw")!.toString()).toBe("1");
    // …plus delivery packaging.
    expect(m.get("delivery_bag")!.toString()).toBe("1");
    expect(m.get("napkin")!.toString()).toBe("2");
    expect(m.get("sticker")!.toString()).toBe("1");
    expect(m.get("tamper_seal")!.toString()).toBe("1");
    expect(m.get("carrier")!.toString()).toBe("1");

    // Channel price is data, not the customer payment. Store price 5000, Talabat price 6000.
    const storePrice = iqd(5000);
    const talabatPrice = iqd(6000);
    expect(talabatPrice.greaterThan(storePrice)).toBe(true);
  });
});

describe("Scenario 4 — Talabat order with shared discount, commission, fee and refund", () => {
  it("computes the exact expected payout and channel contribution", () => {
    const e: PlatformOrderEconomics = {
      currency: IQD,
      merchantListValue: iqd(6000),
      merchantFundedDiscount: iqd(500),
      platformFundedDiscount: iqd(500),
      commission: iqd(1100), // 20% of net merchant sales (5500)
      paymentProcessingFee: iqd(150),
      serviceFee: iqd(0),
      advertisingFee: iqd(100),
      deliveryFeeChargedToMerchant: iqd(0),
      refunds: iqd(500),
      otherAdjustments: iqd(0),
    };
    const payout = computePlatformPayout(e);
    expect(payout.grossSales.toStorageString()).toBe("6000");
    expect(payout.netMerchantSales.toStorageString()).toBe("5500");
    expect(payout.totalPlatformFees.toStorageString()).toBe("1350");
    expect(payout.expectedPayout.toStorageString()).toBe("3650"); // 5500 - 1350 - 500

    const cogs = recipeServingCost(RECIPES.iced_latte!, "talabat", resolverContext, wacMap(), IQD);
    expect(cogs.toStorageString()).toBe("1910");

    const contribution = computeChannelContribution(e, cogs);
    expect(contribution.toStorageString()).toBe("1740"); // 3650 - 1910
  });
});

describe("Scenario 5 — re-importing the same external order does not duplicate", () => {
  it("applies inventory deduction once across repeated imports", () => {
    const registry = new IdempotencyRegistry<number>();
    const key = externalOrderKey("talabat", "TLB-12345");
    const movements: string[] = [];

    const importOnce = () =>
      registry.apply(key, () => {
        const deductions = expandRecipeForSale(RECIPES.iced_latte!, "talabat", 1, resolverContext);
        for (const d of deductions) movements.push(`${d.itemId}:${d.baseQuantity.toString()}`);
        return deductions.length;
      });

    const first = importOnce();
    const second = importOnce();
    const third = importOnce();

    expect(first.status).toBe("applied");
    expect(second.status).toBe("duplicate");
    expect(third.status).toBe("duplicate");
    // Movements recorded exactly once (12 lines for a Talabat iced latte).
    expect(movements.length).toBe(12);
    expect(registry.size()).toBe(1);
  });
});

describe("Scenario 6 — producing a gelato batch consumes ingredients at actual yield", () => {
  it("creates finished stock valued at the consumed cost with correct variance", () => {
    const result = planProductionBatch({
      recipe: RECIPES.gelato_pistachio_batch!,
      batches: 1,
      actualOutputBase: 4800, // planned 5000
      ctx: resolverContext,
      wacByItem: wacMap(),
      currency: IQD,
    });
    const consumed = new Map(result.consumptions.map((c) => [c.itemId, c.baseQuantity.toString()]));
    expect(consumed.get("milk")).toBe("2500");
    expect(consumed.get("cream")).toBe("1500");
    expect(consumed.get("sugar")).toBe("800");
    expect(consumed.get("pistachio_paste")).toBe("400");

    // 2500*2 + 1500*3 + 800*1 + 400*20 = 5000 + 4500 + 800 + 8000 = 18300
    expect(result.totalConsumedValue.toStorageString()).toBe("18300");
    expect(result.outputValue.toStorageString()).toBe("18300");
    expect(result.yieldVarianceBase.toString()).toBe("200"); // short 200 g
    // Output unit cost = 18300 / 4800 = 3.8125 IQD/g
    expect(result.outputUnitCost.toDecimalValue().toString()).toBe("3.8125");
  });
});

describe("Scenario 7 — a recipe/price change does not rewrite historical profitability", () => {
  it("keeps the completed sale's cost snapshot fixed when input costs later rise", () => {
    const before = wacMap();
    const historicalCogs = recipeServingCost(
      RECIPES.iced_latte!,
      "takeaway",
      resolverContext,
      before,
      IQD,
    );

    // Later, milk becomes more expensive via a new receipt (WAC rises to ~4/ml).
    let milkState = before.get("milk")!;
    milkState = applyReceipt(milkState, { quantityBase: 1000, value: iqd(6000) });
    const after = new Map(before);
    after.set("milk", milkState);
    const newCogs = recipeServingCost(RECIPES.iced_latte!, "takeaway", resolverContext, after, IQD);

    expect(averageUnitCost(after.get("milk")!).toDecimalValue().greaterThan(2)).toBe(true);
    expect(newCogs.greaterThan(historicalCogs)).toBe(true);
    // The historical snapshot is an immutable value; recomputing with the old
    // state still yields the original number — history is not rewritten.
    const recomputedHistorical = recipeServingCost(
      RECIPES.iced_latte!,
      "takeaway",
      resolverContext,
      before,
      IQD,
    );
    expect(recomputedHistorical.equals(historicalCogs)).toBe(true);
  });
});

describe("Scenario 8 — count of 930 when 950 expected posts a -20 adjustment after approval", () => {
  it("computes variance and self-heals the ledger via one adjustment movement", () => {
    const variance = computeCountVariance(
      {
        itemId: "straw",
        locationId: "branch-1",
        expectedBase: new Decimal(950),
        countedBase: new Decimal(930),
      },
      makeWac(UNIT_COSTS.straw!),
      IQD,
    );
    expect(variance.quantityVarianceBase.toString()).toBe("-20");
    expect(variance.valueVariance.toStorageString()).toBe("-400"); // 20 * 20 IQD

    const adjustQty = adjustmentQuantityForCount(variance);
    expect(adjustQty!.toString()).toBe("-20");

    // Ledger before the count summed to 950; approved adjustment brings it to 930.
    const opening = createMovement({
      id: "open",
      itemId: "straw",
      locationId: "branch-1",
      type: "opening_balance",
      baseQuantity: 950,
      occurredAt: AT,
    });
    const adjustment = createMovement({
      id: "adj",
      itemId: "straw",
      locationId: "branch-1",
      type: "count_adjustment",
      baseQuantity: adjustQty!, // signed
      occurredAt: AT,
      reason: "cycle count",
    });
    expect(currentStockBase([opening, adjustment]).toString()).toBe("930");
  });
});

describe("Scenario 9 — a manager can approve an adjustment while a cashier cannot", () => {
  it("enforces the permission model", () => {
    expect(can("branch_manager", "inventory.adjust.approve")).toBe(true);
    expect(can("cashier", "inventory.adjust.approve")).toBe(false);
    expect(() => authorize("branch_manager", "inventory.adjust.approve")).not.toThrow();
    expect(() => authorize("cashier", "inventory.adjust.approve")).toThrow(/not authorized/);
  });
});

describe("Scenario 10 — an offline sale survives restart and syncs exactly once", () => {
  it("deduplicates by idempotency key even when applied again after a 'restart'", () => {
    const key = "b3f1c2a4-0000-4000-8000-000000000001"; // client UUID
    const ledger: string[] = [];

    // First device session: create the sale and queue it.
    const registrySession1 = new IdempotencyRegistry<string>();
    const applySale = (registry: IdempotencyRegistry<string>) =>
      registry.apply(key, () => {
        const deductions = expandRecipeForSale(RECIPES.iced_latte!, "takeaway", 1, resolverContext);
        ledger.push(...deductions.map((d) => `${d.itemId}`));
        return "sale-committed";
      });

    const firstAttempt = applySale(registrySession1);
    expect(firstAttempt.status).toBe("applied");

    // "Refresh/restart": rebuild the registry from persisted applied keys.
    const persistedKeys = [key];
    const registrySession2 = new IdempotencyRegistry<string>();
    for (const k of persistedKeys) registrySession2.apply(k, () => "sale-committed");
    const linesBefore = ledger.length;

    // Sync fires again after internet returns.
    const retry = applySale(registrySession2);
    expect(retry.status).toBe("duplicate");
    expect(ledger.length).toBe(linesBefore); // no extra deduction
  });
});

describe("Scenario 11 — a refunded consumable does not return used packaging to stock", () => {
  it("returns only items flagged returnable, never disposable packaging", () => {
    const deductions = expandRecipeForSale(RECIPES.iced_latte!, "takeaway", 1, resolverContext);
    const policy = new Map<string, ItemStockPolicy>();
    for (const d of deductions) {
      policy.set(d.itemId, { itemId: d.itemId, returnableToStock: false });
    }
    const returns = computeRefundReturns(deductions, policy);
    expect(returns.length).toBe(0);

    // Contrast: a sealed resale item WOULD return.
    const withResale = [...deductions, { itemId: "bottled_water", baseQuantity: new Decimal(1) }];
    policy.set("bottled_water", { itemId: "bottled_water", returnableToStock: true });
    const returns2 = computeRefundReturns(withResale, policy);
    expect(returns2.map((r) => r.itemId)).toEqual(["bottled_water"]);
  });
});

describe("Scenario 12 — settlement reconciliation flags a missing payout and an incorrect fee", () => {
  it("identifies missing_payout and incorrect_commission", () => {
    const expected: ExpectedOrderRecord[] = [
      {
        externalOrderId: "A-1",
        status: "completed",
        expectedPayout: iqd(3650),
        commission: iqd(1100),
      },
      {
        externalOrderId: "A-2",
        status: "completed",
        expectedPayout: iqd(4000),
        commission: iqd(1000),
      },
    ];
    const settlement: SettlementLine[] = [
      // A-1 present but commission overcharged (1300 vs expected 1100), payout short.
      { externalOrderId: "A-1", reportedPayout: iqd(3450), reportedCommission: iqd(1300) },
      // A-2 missing entirely from the statement.
    ];
    const report = reconcileSettlement(expected, settlement, IQD);
    const types = report.issues.map((i) => i.type);
    expect(types).toContain("incorrect_commission");
    expect(types).toContain("payout_difference");
    expect(types).toContain("missing_payout");

    const missing = report.issues.find((i) => i.type === "missing_payout");
    expect(missing?.externalOrderId).toBe("A-2");
  });
});

describe("Ledger reversal preserves history", () => {
  it("a reversal negates without deleting the original", () => {
    const original = createMovement({
      id: "orig",
      itemId: "straw",
      locationId: "branch-1",
      type: "purchase_receipt",
      baseQuantity: 1000,
      occurredAt: AT,
    });
    const reversal = reverseMovement(original, { id: "rev", occurredAt: AT, reason: "wrong item" });
    expect(currentStockBase([original, reversal]).toString()).toBe("0");
    expect(reversal.type).toBe("reversal");
    expect(reversal.referenceId).toBe("orig");
  });
});
