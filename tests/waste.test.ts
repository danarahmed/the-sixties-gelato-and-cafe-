import { describe, expect, it } from "vitest";
import { bigQty, recipeWaste, type WasteBatch } from "@/lib/waste";

const story = (s: Partial<Record<string, number>>) => ({
  made: 0,
  sold: 0,
  used: 0,
  lost: 0,
  counted: 0,
  moved: 0,
  corrected: 0,
  left: 0,
  ...s,
});
const batch = (b: Partial<WasteBatch> & { recipe: string }): WasteBatch => ({
  batchId: `${b.recipe}-${Math.random()}`,
  item: b.recipe,
  baseUnit: "g",
  status: "completed",
  actual: 5000,
  value: 50_000,
  story: story({}),
  losses: {},
  ...b,
});

describe("waste by recipe (round six)", () => {
  // Three pans of pistachio, all gone: 3.5 kg sold of each, 1.2 kg past its
  // use-by and 300 g eaten by the staff.
  const pistachio = [1, 2, 3].map(() =>
    batch({
      recipe: "Pistachio gelato",
      story: story({ made: 5000, sold: 3500, lost: 1500 }),
      losses: { expired: 1200, staff_consumption: 300 },
    }),
  );
  // A base: one all used but a litre melted away, one still mostly in stock.
  const base = [
    batch({
      recipe: "Base",
      baseUnit: "ml",
      actual: 10_000,
      value: 20_000,
      story: story({ made: 10_000, used: 9000, lost: 1000 }),
      losses: { melt_evaporation: 1000 },
    }),
    batch({
      recipe: "Base",
      baseUnit: "ml",
      actual: 10_000,
      value: 20_000,
      story: story({ made: 10_000, used: 4000, left: 6000 }),
    }),
  ];
  const cancelled = batch({
    recipe: "Cancelled",
    status: "cancelled",
    story: story({ made: 5000, lost: 5000 }),
    losses: { expired: 5000 },
  });
  const [p, b] = recipeWaste([...base, ...pistachio, cancelled]);

  it("each recipe's batches added up, the costliest waste first, a cancelled batch left out", () => {
    expect([p?.recipe, b?.recipe]).toEqual(["Pistachio gelato", "Base"]);
    expect(recipeWaste([cancelled])).toEqual([]);
    expect(p).toMatchObject({
      batches: 3,
      made: 15_000,
      sold: 10_500,
      thrown: 3600,
      unsold: 3600,
      handled: 0,
      given: 900,
      left: 0,
      open: 0,
      value: 36_000,
      givenValue: 9000,
      goneValue: 150_000,
    });
    expect(p!.share).toBeCloseTo(0.24, 6);
  });

  it("mostly left unsold, from batches all gone: the batch that would have covered what went", () => {
    expect(p).toMatchObject({ perBatch: 5000, takenPerBatch: 3800, better: 3800 });
  });

  it("melted away, or under a tenth of what went: no batch is said", () => {
    expect(b).toMatchObject({
      made: 20_000,
      sold: 13_000,
      thrown: 1000,
      handled: 1000,
      unsold: 0,
      left: 6000,
      open: 1,
      better: null,
    });
    // Of the 14 litres gone, one was thrown away.
    expect(b!.share).toBeCloseTo(1 / 14, 6);
    // Its one batch all gone made 10 litres, all but the melted one used.
    expect(b).toMatchObject({ perBatch: 10_000, takenPerBatch: 9000 });
    const melted = recipeWaste([
      ...[1, 2].map(() =>
        batch({
          recipe: "Sorbet",
          story: story({ made: 4000, sold: 2000, lost: 2000 }),
          losses: { melt_evaporation: 1500, expired: 500 },
        }),
      ),
    ])[0]!;
    expect(melted.share).toBe(0.5);
    expect(melted.better).toBeNull();
  });

  it("a loss taken back on review is not thrown away; what was given is never", () => {
    const [r] = recipeWaste([
      batch({
        recipe: "Mango",
        story: story({ made: 1000, sold: 600, lost: 200, left: 200 }),
        losses: { expired: 300, sampling: 0 },
      }),
      batch({
        recipe: "Mango",
        story: story({ made: 1000, sold: 900, lost: 100 }),
        losses: { complimentary: 100 },
      }),
    ]);
    expect(r).toMatchObject({ thrown: 200, given: 100, left: 200, open: 1 });
    // One batch all gone is too few to say a batch by.
    expect(r!.better).toBeNull();
  });

  it("quantities as read: kilos and litres from a thousand, rounded down for a batch", () => {
    expect(bigQty(3800, "g")).toEqual({ qty: "3.8", unit: "kg" });
    expect(bigQty(3850, "g")).toEqual({ qty: "3.9", unit: "kg" });
    expect(bigQty(3850, "g", true)).toEqual({ qty: "3.8", unit: "kg" });
    expect(bigQty(15_000, "g")).toEqual({ qty: "15", unit: "kg" });
    expect(bigQty(950, "g")).toEqual({ qty: "950", unit: "g" });
    expect(bigQty(2500, "ml")).toEqual({ qty: "2.5", unit: "L" });
    expect(bigQty(12.4, "each")).toEqual({ qty: "12", unit: "each" });
  });
});
