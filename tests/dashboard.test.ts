/**
 * What the dashboard says about today (src/lib/dashboard.ts): today against a
 * usual day of its kind by the same time, never against a whole one; a day
 * the café was closed left out of "usual"; a product with no cost never read
 * as one with a fine margin.
 */
import { describe, expect, it } from "vitest";
import {
  busiestHour,
  direction,
  hourSpan,
  kept,
  pace,
  percent,
  salesBy,
  sameWeekdaysBefore,
  thinnestMargin,
  topSellers,
  usualHours,
  type HourSales,
  type ProductSales,
} from "@/lib/dashboard";

const h = (hour: number, net: number, orders = 1): HourSales => ({ hour, net, orders });
const product = (name: string, net: number, cost: number, qty = 5): ProductSales => ({
  name,
  net,
  cost,
  margin: net - cost,
  qty,
});

describe("a usual day of today's kind", () => {
  it("is the same weekday in the four weeks before, the nearest first", () => {
    expect(sameWeekdaysBefore("2026-10-03")).toEqual([
      "2026-09-26",
      "2026-09-19",
      "2026-09-12",
      "2026-09-05",
    ]);
    // Across the turn of a year and a month.
    expect(sameWeekdaysBefore("2026-01-03", 1)).toEqual(["2025-12-27"]);
  });

  it("is counted to the same time: the whole hours before, and the part of this one that has passed", () => {
    const day = [h(8, 1000, 2), h(9, 2000, 4), h(10, 3000, 6)];
    expect(salesBy(day, 9, 30)).toEqual({ net: 2000, orders: 4 });
    expect(salesBy(day, 9, 0)).toEqual({ net: 1000, orders: 2 });
    expect(salesBy(day, 11, 0)).toEqual({ net: 6000, orders: 12 });
    expect(salesBy(day, 7, 59)).toEqual({ net: 0, orders: 0 });
  });

  it("sets today so far against it, leaving out a day the café was closed", () => {
    const today = [h(8, 1000), h(9, 500)];
    const open = [h(8, 1000), h(9, 2000), h(10, 3000)];
    const closed = [h(8, 0, 0), h(9, 0, 0)];
    const p = pace(today, [open, closed, []], 9, 30);
    expect(p.days).toBe(1);
    expect(p.net).toBe(1500);
    expect(p.usualNet).toBe(2000);
    expect(p.netChange).toBeCloseTo(-0.25, 10);
    expect(direction(p.netChange)).toBe("down");
    expect(percent(p.netChange!)).toBe(25);
  });

  it("is none when every day before was closed: nothing is compared", () => {
    const p = pace([h(9, 500)], [[], [h(9, 0, 0)]], 10, 0);
    expect(p.usualNet).toBeNull();
    expect(p.netChange).toBeNull();
    expect(direction(p.netChange)).toBeNull();
  });

  it("averages its hours over the days the café was open, and finds its busiest", () => {
    const usual = usualHours([[h(8, 1000), h(14, 4000)], [h(8, 3000), h(14, 6000)], []]);
    expect(usual).toEqual([h(8, 2000, 1), h(14, 5000, 1)]);
    expect(busiestHour(usual)).toBe(14);
    expect(busiestHour([])).toBeNull();
  });
});

describe("what the figures say", () => {
  it("calls a change within 5% either way as usual", () => {
    expect(direction(0.049)).toBe("same");
    expect(direction(-0.049)).toBe("same");
    expect(direction(0.05)).toBe("up");
    expect(direction(-0.05)).toBe("down");
  });

  it("draws the hours from the first to the last any day sold in", () => {
    expect(hourSpan([h(9, 100)], [h(8, 0, 0), h(13, 200)])).toEqual([9, 10, 11, 12, 13]);
    expect(hourSpan([], [])).toEqual([]);
  });

  it("never reads a product with no cost as one with a fine margin", () => {
    expect(kept(product("Croissant", 10000, 0))).toBeNull();
    expect(kept(product("Latte", 10000, 3800))).toBeCloseTo(0.62, 10);
    expect(kept(product("Refunded", 0, 100))).toBeNull();
  });

  it("names the thinnest margin under 30%, sold three times or more, costed", () => {
    const sold = [
      product("Latte", 10000, 3800),
      product("Croissant", 8000, 7000),
      product("Water", 2000, 0), // not costed: left out
      product("Cake", 3000, 2900, 2), // sold twice: too few to judge
      product("Cone", 6000, 4500),
    ];
    const thin = thinnestMargin(sold);
    expect(thin?.name).toBe("Croissant");
    expect(thin?.kept).toBeCloseTo(0.125, 10);
    expect(thinnestMargin([product("Latte", 10000, 3800)])).toBeNull();
  });

  it("lists what brought in the most, the largest first, ties by name", () => {
    const sold = [
      product("B", 500, 100),
      product("A", 500, 100),
      product("C", 900, 100),
      product("Free", 0, 0),
    ];
    expect(topSellers(sold, 5).map((p) => p.name)).toEqual(["C", "A", "B"]);
    expect(topSellers(sold, 1).map((p) => p.name)).toEqual(["C"]);
  });
});
