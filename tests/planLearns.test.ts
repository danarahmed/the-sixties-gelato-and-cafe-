/**
 * The plan learns and What to buy looks ahead (0070), as the screens read
 * them: what the plan learnt from the weeks it judged by, and why a line of
 * What to buy is what it is — each day by its weekday, what was thrown away
 * left out, what today's plan needs, and what keeps only a few days.
 */
import { describe, expect, it } from "vitest";
import { planFrom } from "@/lib/production";
import { buyingLineFrom, buyingListFrom, reasonsOf } from "@/lib/buying";

const recipe = {
  recipe_id: "r",
  recipe: "Chocolate gelato",
  item_id: "i",
  item: "Chocolate gelato",
  base_unit: "g",
  batch_yield: 4000,
  yield_unit: "kg",
  status: "make",
  history_days: 28,
  weeks: 4,
  on_hand: 0,
  due: 0,
  good: 0,
  ingredients: [],
};

describe("the day's plan learns (0070)", () => {
  it("reads what it learnt, and each day it judged by", () => {
    const plan = planFrom({
      day: "2026-10-06",
      weekday: 2,
      location: "Main Branch",
      recipes: [
        {
          ...recipe,
          days: [
            { day: "2026-09-29", used: 4000, wasted: 0, sold_out: true },
            { day: "2026-09-08", used: 2000, wasted: 0, sold_out: false },
          ],
          demand: 5250,
          seen: 3250,
          sold_out_days: 2,
          waste_days: 0,
          wasted_avg: 0,
          bump: 2000,
          trim: 0,
          learned: "sold_out",
          to_make: 5250,
          batches: 2,
          makes: 8000,
        },
        {
          ...recipe,
          recipe: "Lemon sorbet",
          batch_yield: 2000,
          days: [{ day: "2026-09-29", used: 2500, wasted: 1500, sold_out: false }],
          demand: 2500,
          seen: 2500,
          sold_out_days: 0,
          waste_days: 4,
          wasted_avg: 1500,
          bump: 0,
          trim: 500,
          learned: "waste",
          to_make: 2000,
          batches: 1,
          makes: 2000,
        },
        { ...recipe, recipe: "Mango sorbet", demand: 500, seen: 500, learned: null },
      ],
      ingredients: [],
    });
    expect(plan.learns).toBe(true);
    const [choc, lemon, mango] = plan.recipes;
    expect(choc).toMatchObject({
      seen: 3250,
      demand: 5250,
      soldOutDays: 2,
      bump: 2000,
      learned: "sold_out",
      batches: 2,
    });
    expect(choc?.days).toEqual([
      { day: "2026-09-29", used: 4000, wasted: 0, soldOut: true },
      { day: "2026-09-08", used: 2000, wasted: 0, soldOut: false },
    ]);
    expect(lemon).toMatchObject({ wasteDays: 4, wastedAvg: 1500, trim: 500, learned: "waste" });
    expect(lemon?.days[0]).toMatchObject({ wasted: 1500, soldOut: false });
    expect(mango).toMatchObject({ learned: null, bump: 0, trim: 0 });
  });

  it("before the update, what it makes for is what went, and it learns nothing", () => {
    const plan = planFrom({
      recipes: [{ ...recipe, demand: 2000, days: [{ day: "2026-09-29", used: 2000 }] }],
    });
    expect(plan.learns).toBe(false);
    expect(plan.recipes[0]).toMatchObject({ seen: 2000, demand: 2000, learned: null });
    expect(plan.recipes[0]?.days[0]).toEqual({
      day: "2026-09-29",
      used: 2000,
      wasted: 0,
      soldOut: false,
    });
  });
});

const line = {
  item_id: "c",
  item: "Cones",
  base_unit: "g",
  item_type: "packaging",
  status: "order",
  on_hand: 1500,
  on_order: 0,
  in_draft: 0,
  on_way: 0,
  position: 1500,
  history_days: 30,
  days: 28,
  used: 9100,
  wasted: 1400,
  daily_use: 325,
  forecast: "weekday",
  lead_use: 2100,
  plan_need: 0,
  plan_extra: 0,
  keeps_days: null,
  capped: false,
  cap_level: null,
  lead_time: 1,
  lead_from: "cafe",
  reorder_level: 2100,
  reorder_from: "use",
  target_level: 4375,
  target_from: "week",
  pack_unit: "g",
  pack_factor: 1,
  packs: 2875,
  qty_base: 2875,
  choices: [],
};

describe("What to buy looks ahead (0070)", () => {
  it("judges the days until a delivery each by its weekday, and leaves waste out of use", () => {
    const l = buyingLineFrom(line);
    expect(l).toMatchObject({ forecast: "weekday", leadUse: 2100, wasted: 1400, capped: false });
    expect(reasonsOf(l)).toEqual([
      "1,500 g on hand.",
      "Each day judged by its weekday over the last 4 weeks: until a delivery comes, in 1 day, and a day more, it uses about 2,100 g: 2,100 g is its reorder level.",
      "Below it: to order.",
      "1,400 g thrown away unsold in the last 28 days is not counted as use.",
      "Ordered up to the reorder level and a week of use: 4,375 g.",
      "2,875 g to order.",
    ]);
  });

  it("adds what today's plan needs beyond its weekday's batches, and buys for the plan alone", () => {
    const cocoa = buyingLineFrom({
      ...line,
      item: "Cocoa",
      used: 1500,
      wasted: 0,
      daily_use: 53.571,
      lead_use: 375,
      plan_need: 1000,
      plan_extra: 625,
      reorder_level: 1000,
      on_hand: 300,
      position: 300,
    });
    expect(reasonsOf(cocoa).slice(1, 4)).toEqual([
      "Each day judged by its weekday over the last 4 weeks: until a delivery comes, in 1 day, and a day more, it uses about 375 g: 1,000 g is its reorder level.",
      "With what today's plan needs beyond what its weekday's batches use: 625 g.",
      "Below it: to order.",
    ]);
    const fresh = buyingLineFrom({
      ...line,
      item: "Cocoa",
      used: 0,
      wasted: 0,
      daily_use: null,
      forecast: null,
      lead_use: null,
      history_days: 0,
      days: 0,
      plan_need: 1000,
      plan_extra: 1000,
      reorder_level: 1000,
      reorder_from: "plan",
      target_level: 1000,
      target_from: "reorder",
      on_hand: 300,
      position: 300,
      packs: 700,
      qty_base: 700,
    });
    expect(fresh.reorderFrom).toBe("plan");
    expect(reasonsOf(fresh).slice(1, 3)).toEqual([
      "Not used here yet, but today's plan needs 1,000 g: 1,000 g is its reorder level.",
      "Below it: to order.",
    ]);
  });

  it("orders what keeps a few days up to no more than they use, never below its reorder level", () => {
    const cream = {
      ...line,
      item: "Cream",
      base_unit: "ml",
      used: 20000,
      wasted: 0,
      daily_use: 1000,
      forecast: "average",
      lead_use: 2000,
      reorder_level: 2000,
      target_from: "par",
      on_hand: 500,
      position: 500,
      pack_unit: "carton_1l",
      pack_factor: 1000,
    };
    const three = buyingLineFrom({
      ...cream,
      keeps_days: 3,
      capped: true,
      cap_level: 3000,
      target_level: 3000,
      packs: 2,
      qty_base: 2000,
    });
    const carton = (c: string) => (c === "carton_1l" ? "Carton of 1 L" : c);
    expect(reasonsOf(three, undefined, carton).slice(-2)).toEqual([
      "It keeps 3 days: ordered up to no more than they use, 3,000 ml.",
      "2 × Carton of 1 L (2,000 ml), in whole packs.",
    ]);
    const one = buyingLineFrom({
      ...cream,
      keeps_days: 1,
      capped: true,
      cap_level: 1000,
      target_level: 2000,
      packs: 2,
      qty_base: 2000,
    });
    expect(reasonsOf(one, undefined, carton).at(-2)).toBe(
      "It keeps 1 day, but must last until the next delivery: ordered up to its reorder level, 2,000 ml.",
    );
    // Said, but what is ordered is used before then: as before.
    const enough = buyingLineFrom({
      ...cream,
      keeps_days: 30,
      target_level: 10000,
      packs: 10,
      qty_base: 10000,
    });
    expect(reasonsOf(enough, undefined, carton).slice(-2)).toEqual([
      "Ordered up to its par level, 10,000 ml.",
      "10 × Carton of 1 L (10,000 ml), rounded up to whole packs.",
    ]);
  });

  it("says how long an item keeps only once the update is in", () => {
    expect(buyingListFrom({ items: [line] }).looksAhead).toBe(true);
    const { capped: _c, ...before } = line;
    expect(buyingListFrom({ items: [before] }).looksAhead).toBe(false);
    expect(buyingListFrom({ items: [] }).looksAhead).toBe(false);
    expect(buyingLineFrom(before)).toMatchObject({
      wasted: 1400,
      capped: false,
      keepsDays: null,
      planExtra: 0,
    });
  });
});
