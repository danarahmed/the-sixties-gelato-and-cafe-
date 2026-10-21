/**
 * A refund gives back the service charge on what it refunds (0090), worked
 * out on the Orders screen as the database works it out.
 */
import { describe, expect, it } from "vitest";
import { serviceBack, type RefundableLine } from "@/lib/refunds";

const waters: RefundableLine[] = [
  { id: "w", name: "Water", qty: 3, lineNet: 3000, refundedQty: 0, refundedAmount: 0 },
];
const service = { amount: 300, back: 0, net: 3000 };

describe("the service charge given back with a refund", () => {
  it("gives back its share of what is refunded", () => {
    expect(serviceBack(waters, { w: "1" }, service, 1000)).toBe(100);
  });
  it("gives back all that is left of it with the last of the sale", () => {
    const left = [{ ...waters[0]!, refundedQty: 1, refundedAmount: 1000 }];
    expect(serviceBack(left, { w: "2" }, { ...service, back: 100 }, 2000)).toBe(200);
  });
  it("rounds to whole dinars, half to even, and never more than is left", () => {
    expect(serviceBack(waters, { w: "1" }, { amount: 250, back: 0, net: 2500 }, 1250)).toBe(125);
    expect(serviceBack(waters, { w: "1" }, { amount: 5, back: 0, net: 20 }, 10)).toBe(2);
    expect(serviceBack(waters, { w: "1" }, { amount: 300, back: 290, net: 3000 }, 1000)).toBe(10);
  });
  it("gives back none on a sale that took none", () => {
    expect(serviceBack(waters, { w: "1" }, null, 1000)).toBe(0);
  });
});
