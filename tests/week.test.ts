import { describe, expect, it } from "vitest";
import { bestDay, dayByDay, daysOf, movers, splitWeeks, totals, weekWindow } from "@/lib/week";

describe("the week at a glance (round four)", () => {
  const w = weekWindow("2026-10-04");

  it("the seven days to a day, and the seven before them", () => {
    expect(w).toEqual({
      from: "2026-09-28",
      to: "2026-10-04",
      beforeFrom: "2026-09-21",
      beforeTo: "2026-09-27",
    });
    expect(daysOf(w.from, w.to)).toHaveLength(7);
  });

  const rows = [
    { day: "2026-09-21", net: 100000, cost: 30000, orders: 20 },
    { day: "2026-09-27", net: 200000, cost: 50000, orders: 40 },
    { day: "2026-09-28", net: 150000, cost: 60000, orders: 25 },
    { day: "2026-10-03", net: 250000, cost: 90000, orders: 50 },
    { day: "2026-10-04", net: 0, cost: 0, orders: 0 },
  ];

  it("each week's figures: sales, margin, its share, and an order's average", () => {
    const { now, before } = splitWeeks(rows, w);
    expect(now).toEqual({
      net: 400000,
      cost: 150000,
      margin: 250000,
      orders: 75,
      marginPct: 62.5,
      perOrder: 400000 / 75,
    });
    expect(before.net).toBe(300000);
    expect(before.marginPct).toBe(73.3);
    expect(totals([])).toEqual({
      net: 0,
      cost: 0,
      margin: 0,
      orders: 0,
      marginPct: null,
      perOrder: null,
    });
  });

  it("day by day, each beside the same weekday of the week before", () => {
    const days = dayByDay(rows, w);
    expect(days.map((d) => d.day)).toEqual(daysOf("2026-09-28", "2026-10-04"));
    expect(days[0]).toEqual({
      day: "2026-09-28",
      net: 150000,
      orders: 25,
      before: "2026-09-21",
      beforeNet: 100000,
    });
    expect(days[6]?.beforeNet).toBe(200000);
    expect(bestDay(days)?.day).toBe("2026-10-03");
    expect(bestDay([])).toBeNull();
  });

  it("the best sellers, and what rose and fell the most in dinars", () => {
    const now = [
      { key: "p", name: "Pistachio", net: 320000 },
      { key: "v", name: "Vanilla", net: 150000 },
      { key: "n", name: "New sorbet", net: 40000 },
      { key: "s", name: "Small cookie", net: 5000 },
    ];
    const before = [
      { key: "p", name: "Pistachio", net: 230000 },
      { key: "v", name: "Vanilla", net: 210000 },
      { key: "s", name: "Small cookie", net: 1000 },
      { key: "m", name: "Mango", net: 80000 },
    ];
    const m = movers(now, before);
    expect(m.best.map((x) => x.name)).toEqual([
      "Pistachio",
      "Vanilla",
      "New sorbet",
      "Small cookie",
    ]);
    expect(m.best[2]).toMatchObject({ before: 0, change: null });
    // Pistachio rose 90,000 (the cookie's 400% is 4,000); Mango, gone, fell 80,000 — and Vanilla 60,000.
    expect(m.rise).toMatchObject({ name: "Pistachio", before: 230000 });
    expect(m.fall).toMatchObject({ name: "Mango", net: 0, change: -1 });
    expect(movers([], [])).toEqual({ best: [], rise: null, fall: null });
  });
});
