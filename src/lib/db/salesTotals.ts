/**
 * Net sales after refunds, and the margin on them: sales less the recipe cost
 * of what was sold (audit P1-2). Refunds are those made in the dates, and the
 * cost of what went back on the shelf comes off the cost, as in the ledger.
 */
export function salesTotals(
  r: { net: number; cogs: number; refunds: number; returnedCost: number }[],
) {
  const sold = r.reduce((s, x) => s + x.net, 0);
  const refunds = r.reduce((s, x) => s + x.refunds, 0);
  const cost = r.reduce((s, x) => s + x.cogs - x.returnedCost, 0);
  const net = sold - refunds;
  return { sold, refunds, net, cost, margin: net - cost };
}
