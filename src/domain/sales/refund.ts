/**
 * Refund handling for inventory.
 *
 * REFUND RULE: a refund is a financial reversal. It does NOT automatically
 * return physical goods to stock. Only items explicitly flagged as returnable
 * (e.g. a sealed resale bottle handed back unopened) generate a
 * `refund_return_to_stock` movement. Disposable packaging and consumed
 * ingredients (cup, lid, straw, milk, ice) are gone and are never returned.
 */
import Decimal from "decimal.js";
import type { ResolvedDeduction } from "./recipe.js";

export interface ItemStockPolicy {
  itemId: string;
  /** True only for items that can physically re-enter sellable stock on refund. */
  returnableToStock: boolean;
}

export interface RefundReturn {
  itemId: string;
  baseQuantity: Decimal;
}

/**
 * Given the deductions a sale made and each item's return policy, compute which
 * quantities re-enter stock on a full refund. Non-returnable items are omitted.
 */
export function computeRefundReturns(
  saleDeductions: readonly ResolvedDeduction[],
  policyByItem: ReadonlyMap<string, ItemStockPolicy>,
): RefundReturn[] {
  const returns: RefundReturn[] = [];
  for (const d of saleDeductions) {
    const policy = policyByItem.get(d.itemId);
    if (policy?.returnableToStock) {
      returns.push({ itemId: d.itemId, baseQuantity: d.baseQuantity });
    }
  }
  return returns;
}
