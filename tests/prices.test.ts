import { describe, expect, it } from "vitest";
import { madeUses, riseOf, servingUses, touch } from "@/lib/prices";

describe("the price watch (round five)", () => {
  const d = (
    receivedAt: string,
    costPerBase: number | null,
    landedPerBase: number | null = null,
  ) => ({
    receivedAt,
    supplier: "Dairy Co",
    costPerBase,
    landedPerBase,
  });

  it("an item's latest delivery against the one before: a rise of 5% or more, lately", () => {
    // Newest first; the freight shared out counts where it is known.
    const milk = [d("2026-10-02T09:00:00Z", 1.2, 1.25), d("2026-09-20T09:00:00Z", 1, 1)];
    expect(riseOf(milk, "2026-09-04")).toEqual({
      was: 1,
      now: 1.25,
      change: 0.25,
      on: "2026-10-02T09:00:00Z",
      supplier: "Dairy Co",
    });
    // Too long ago, too little, cheaper, or nothing to compare with: none.
    expect(riseOf(milk, "2026-10-03")).toBeNull();
    expect(riseOf([d("2026-10-02", 1.04), d("2026-09-20", 1)], "2026-09-04")).toBeNull();
    expect(riseOf([d("2026-10-02", 0.9), d("2026-09-20", 1)], "2026-09-04")).toBeNull();
    expect(riseOf([d("2026-10-02", 1.5)], "2026-09-04")).toBeNull();
    // A delivery with no price is passed over.
    expect(
      riseOf([d("2026-10-02", 1.5), d("2026-09-25", null), d("2026-09-20", 1)], "2026-09-04"),
    ).toMatchObject({ was: 1, now: 1.5 });
  });

  // Milk goes into the base (4 L a 5 L batch), the base into the gelato (4.5 L a 5 kg pan).
  const made = [
    {
      outputItemId: "base",
      yieldBase: 5000,
      lines: [
        { itemId: "milk", baseQty: 4000 },
        { itemId: "sugar", baseQty: 800 },
      ],
    },
    {
      outputItemId: "gelato",
      yieldBase: 5000,
      lines: [
        { itemId: "base", baseQty: 4500 },
        { itemId: "paste", baseQty: 500 },
      ],
    },
  ];

  it("what a base unit of each made item uses of an item, through every recipe", () => {
    const uses = madeUses("milk", made);
    expect(uses.get("base")).toBeCloseTo(0.8);
    expect(uses.get("gelato")).toBeCloseTo(0.72);
    expect(madeUses("paste", made).get("base")).toBeUndefined();
  });

  it("what a serving uses: on its recipe, and through what is made from it, on its channel", () => {
    const factor = (_item: string, unit: string) => (unit === "L" || unit === "kg" ? 1000 : 1);
    const lines = [
      { variantId: "latte", itemId: "milk", quantity: 200, unitCode: "ml", channels: null },
      { variantId: "cup", itemId: "gelato", quantity: 150, unitCode: "g", channels: null },
      { variantId: "cup", itemId: "cone", quantity: 1, unitCode: "each", channels: ["takeaway"] },
      { variantId: "shake", itemId: "milk", quantity: 0.25, unitCode: "L", channels: ["dine_in"] },
      { variantId: "water", itemId: "water", quantity: 1, unitCode: "each", channels: null },
    ];
    const uses = servingUses("milk", lines, made, factor, "dine_in");
    expect(uses.get("latte")).toEqual({ direct: 200, made: 0 });
    expect(uses.get("cup")?.made).toBeCloseTo(108);
    expect(uses.get("shake")).toEqual({ direct: 250, made: 0 });
    expect(uses.has("water")).toBe(false);
    // The shake's milk is for dine-in only.
    expect(servingUses("milk", lines, made, factor, "takeaway").has("shake")).toBe(false);
  });

  it("what the rise does to a serving: the margin before and after, and the price that keeps it", () => {
    const rise = { was: 1, now: 1.25, change: 0.25, on: "2026-10-02", supplier: null };
    // A latte at 3,000: 200 ml of milk and 700 of the rest; the milk on hand averages 1.1 today.
    const t = touch(rise, { direct: 200, made: 0 }, 3000, 920, 1.1);
    expect(t.before).toBeCloseTo(900);
    expect(t.adds).toBeCloseTo(50);
    expect(t.after).toBeCloseTo(950);
    expect(t.marginBefore).toBeCloseTo(0.7);
    expect(t.marginAfter).toBeCloseTo(0.6833, 3);
    // 950 / 0.3 = 3,166.67: 3,250 at a step of 250.
    expect(t.keep).toBe(3250);
    // Through the base, the cost today is the old price's already.
    const cup = touch(rise, { direct: 0, made: 108 }, 4000, 1200, 1.1);
    expect(cup.before).toBe(1200);
    expect(cup.adds).toBeCloseTo(27);
    // A rise too small to need a new price.
    expect(touch(rise, { direct: 1, made: 0 }, 4000, 1000, 1).keep).toBeNull();
  });
});
