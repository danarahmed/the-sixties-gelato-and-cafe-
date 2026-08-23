/**
 * Delivery-platform economics and settlement reconciliation.
 *
 * PLATFORM RULE: the amount a customer pays the platform is NOT the business's
 * revenue and NOT the merchant payout. Each order stores every component
 * separately, and the expected payout is a deterministic sum of them. A
 * platform-funded discount does not reduce merchant revenue (the platform
 * reimburses it); a merchant-funded discount does.
 */
import Decimal from "decimal.js";
import { Money, type Currency } from "../money/money.js";

export interface PlatformOrderEconomics {
  currency: Currency;
  /** Sum of the merchant's platform list prices before any promotion. */
  merchantListValue: Money;
  /** Portion of all discounts funded by the merchant (reduces merchant revenue). */
  merchantFundedDiscount: Money;
  /** Portion of all discounts funded by the platform (reimbursed; does not reduce revenue). */
  platformFundedDiscount: Money;
  /** Platform commission charged to the merchant. */
  commission: Money;
  paymentProcessingFee: Money;
  /** Service fee borne by the merchant (0 when borne by the customer). */
  serviceFee: Money;
  advertisingFee: Money;
  /** Delivery fee charged to the merchant (usually 0 when the platform delivers). */
  deliveryFeeChargedToMerchant: Money;
  /** Refunds that reduce the merchant payout. */
  refunds: Money;
  /** Signed catch-all; positive increases payout, negative decreases it. */
  otherAdjustments: Money;
}

export interface PlatformPayoutBreakdown {
  /** Merchant list value before discounts. */
  grossSales: Money;
  /** List value minus merchant-funded discount. */
  netMerchantSales: Money;
  /** Sum of all platform-charged variable fees. */
  totalPlatformFees: Money;
  /** Deterministic expected payout from the platform to the merchant. */
  expectedPayout: Money;
}

function z(currency: Currency): Money {
  return Money.zero(currency);
}

/** Deterministic payout math from the stored order components. */
export function computePlatformPayout(e: PlatformOrderEconomics): PlatformPayoutBreakdown {
  const grossSales = e.merchantListValue;
  const netMerchantSales = grossSales.subtract(e.merchantFundedDiscount);
  const totalPlatformFees = Money.sum(
    [
      e.commission,
      e.paymentProcessingFee,
      e.serviceFee,
      e.advertisingFee,
      e.deliveryFeeChargedToMerchant,
    ],
    e.currency,
  );
  const expectedPayout = netMerchantSales
    .subtract(totalPlatformFees)
    .subtract(e.refunds)
    .add(e.otherAdjustments);
  return {
    grossSales: grossSales.quantize(),
    netMerchantSales: netMerchantSales.quantize(),
    totalPlatformFees: totalPlatformFees.quantize(),
    expectedPayout: expectedPayout.quantize(),
  };
}

/**
 * Channel contribution profit = expected net cash received minus variable
 * product cost (COGS). Fixed overhead (rent, salaries) is deliberately NOT
 * subtracted here — that requires an allocation method and is a separate,
 * clearly-labelled estimate.
 */
export function computeChannelContribution(e: PlatformOrderEconomics, cogs: Money): Money {
  const { expectedPayout } = computePlatformPayout(e);
  return expectedPayout.subtract(cogs).quantize();
}

/** Recompute commission from a rate and base to validate a platform charge. */
export function expectedCommission(base: Money, ratePercent: Decimal | number | string): Money {
  const rate = new Decimal(ratePercent).dividedBy(100);
  return base.multiply(rate).quantize();
}

// ---------------------------------------------------------------------------
// Settlement reconciliation
// ---------------------------------------------------------------------------

export interface ExpectedOrderRecord {
  externalOrderId: string;
  status: "completed" | "cancelled";
  expectedPayout: Money;
  /** Commission we computed for this order (for fee-mismatch detection). */
  commission: Money;
}

export interface SettlementLine {
  externalOrderId: string;
  /** Payout amount the platform reports for this order. */
  reportedPayout: Money;
  /** Commission the platform reports charging. */
  reportedCommission: Money;
  /** Free-text adjustment note attached by the platform, if any. */
  adjustmentNote?: string;
}

export type ReconciliationIssueType =
  | "missing_payout" // order exists in our system, absent from settlement
  | "unmatched_settlement_line" // settlement line has no matching order
  | "duplicate_settlement_line" // same external order settled more than once
  | "payout_difference" // amounts differ beyond tolerance
  | "incorrect_commission" // reported commission differs from expected
  | "cancelled_still_charged" // cancelled order still deducted/charged
  | "unexplained_adjustment"; // adjustment note with a payout delta

export interface ReconciliationIssue {
  type: ReconciliationIssueType;
  externalOrderId: string;
  detail: string;
  /** Signed monetary impact (reported - expected) where meaningful. */
  delta?: Money;
}

export interface ReconciliationReport {
  matchedCount: number;
  totalExpected: Money;
  totalReported: Money;
  issues: ReconciliationIssue[];
}

/**
 * Match our expected orders against a platform settlement statement and surface
 * every discrepancy. Tolerance is in the smallest currency unit for rounding
 * noise; default 0 (exact) for zero-decimal currencies like IQD.
 */
export function reconcileSettlement(
  expected: ExpectedOrderRecord[],
  settlement: SettlementLine[],
  currency: Currency,
  toleranceMinorUnits = 0,
): ReconciliationReport {
  const tolerance = new Decimal(toleranceMinorUnits);
  const issues: ReconciliationIssue[] = [];

  const expectedById = new Map<string, ExpectedOrderRecord>();
  for (const o of expected) expectedById.set(o.externalOrderId, o);

  // Group settlement lines by order to catch duplicates.
  const settlementById = new Map<string, SettlementLine[]>();
  for (const line of settlement) {
    const arr = settlementById.get(line.externalOrderId) ?? [];
    arr.push(line);
    settlementById.set(line.externalOrderId, arr);
  }

  let matchedCount = 0;

  for (const [orderId, lines] of settlementById) {
    if (lines.length > 1) {
      issues.push({
        type: "duplicate_settlement_line",
        externalOrderId: orderId,
        detail: `${lines.length} settlement lines reference the same order`,
      });
    }
    const line = lines[0]!;
    const order = expectedById.get(orderId);
    if (!order) {
      issues.push({
        type: "unmatched_settlement_line",
        externalOrderId: orderId,
        detail: "Settlement line has no matching order in our records",
        delta: line.reportedPayout.quantize(),
      });
      continue;
    }

    matchedCount += 1;

    if (order.status === "cancelled" && !line.reportedPayout.isZero()) {
      issues.push({
        type: "cancelled_still_charged",
        externalOrderId: orderId,
        detail: "Order was cancelled but the settlement still moved money",
        delta: line.reportedPayout.quantize(),
      });
    }

    const payoutDelta = line.reportedPayout.subtract(order.expectedPayout);
    if (payoutDelta.abs().toDecimalValue().greaterThan(tolerance)) {
      issues.push({
        type: "payout_difference",
        externalOrderId: orderId,
        detail: `Reported payout ${line.reportedPayout.format()} vs expected ${order.expectedPayout.format()}`,
        delta: payoutDelta.quantize(),
      });
    }

    const commissionDelta = line.reportedCommission.subtract(order.commission);
    if (commissionDelta.abs().toDecimalValue().greaterThan(tolerance)) {
      issues.push({
        type: "incorrect_commission",
        externalOrderId: orderId,
        detail: `Reported commission ${line.reportedCommission.format()} vs expected ${order.commission.format()}`,
        delta: commissionDelta.quantize(),
      });
    }

    if (line.adjustmentNote && !payoutDelta.isZero()) {
      issues.push({
        type: "unexplained_adjustment",
        externalOrderId: orderId,
        detail: `Adjustment "${line.adjustmentNote}" with payout delta`,
        delta: payoutDelta.quantize(),
      });
    }
  }

  // Orders we expected but the settlement never mentions.
  for (const [orderId, order] of expectedById) {
    if (!settlementById.has(orderId) && order.status === "completed") {
      issues.push({
        type: "missing_payout",
        externalOrderId: orderId,
        detail: "Completed order is absent from the settlement statement",
        delta: order.expectedPayout.negate().quantize(),
      });
    }
  }

  return {
    matchedCount,
    totalExpected: Money.sum(
      expected.filter((o) => o.status === "completed").map((o) => o.expectedPayout),
      currency,
    ).quantize(),
    totalReported: Money.sum(
      settlement.map((s) => s.reportedPayout),
      currency,
    ).quantize(),
    issues,
  };
}
