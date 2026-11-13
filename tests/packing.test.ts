import { describe, expect, it } from "vitest";
import { defaultPacking, quickOrder, type Line, type PackingSetup } from "@/components/pos/model";

const line = (variantId: string, qty: number): Line => ({
  key: `${variantId}-${qty}`,
  variantId,
  qty,
  note: null,
  lineId: null,
  fallbackName: null,
  billPrice: null,
  addons: [],
});
const item = (
  itemId: string,
  role: PackingSetup["items"][number]["role"],
  takeaway: number,
  delivery: number,
  active = true,
) => ({
  itemId,
  name: itemId,
  nameAr: null,
  nameCkb: null,
  role,
  takeaway,
  delivery,
  active,
});
const setup: PackingSetup = {
  items: [
    item("bag", "bag", 1, 1),
    item("cup-l", "cup", 0, 0),
    item("lid", "lid", 0, 0),
    item("box", "box", 0, 1, false),
  ],
  variants: [
    { variantId: "latte-l", itemId: "cup-l", qty: 1 },
    { variantId: "latte-l", itemId: "lid", qty: 1 },
    { variantId: "latte-l", itemId: "box", qty: 1 },
  ],
};

describe("packing at the till (0107)", () => {
  it("each drink to take away adds its cup and lid, and the order its bag", () => {
    const o = { ...quickOrder("takeaway"), lines: [line("latte-l", 2), line("cake", 1)] };
    expect(defaultPacking(o, setup)).toEqual({ bag: 1, "cup-l": 2, lid: 2 });
  });

  it("dine-in goes out in nothing", () => {
    const o = { ...quickOrder("dine_in"), lines: [line("latte-l", 2)] };
    expect(defaultPacking(o, setup)).toEqual({});
  });

  it("a delivery takes the delivery default; an item put away is never added", () => {
    const o = { ...quickOrder("direct_delivery"), lines: [line("latte-l", 1)] };
    expect(defaultPacking(o, setup)).toEqual({ bag: 1, "cup-l": 1, lid: 1 });
  });

  it("no packing set up: nothing", () => {
    const o = { ...quickOrder("takeaway"), lines: [line("latte-l", 1)] };
    expect(defaultPacking(o, null)).toEqual({});
  });
});
