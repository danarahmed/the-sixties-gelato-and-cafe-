import { describe, expect, it } from "vitest";
import {
  bestDay,
  dayByDay,
  daysOf,
  monthDayByDay,
  monthPace,
  monthWindow,
  movers,
  splitWeeks,
  totals,
  usualByWeekday,
  weekWindow,
  weekdayIndex,
  weekdaysApart,
} from "@/lib/week";

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

describe("the month at a glance (round five)", () => {
  it("a month running, to today, against the same days of the month before", () => {
    expect(monthWindow("2026-10-04", "2026-10-04")).toEqual({
      from: "2026-10-01",
      to: "2026-10-04",
      beforeFrom: "2026-09-01",
      beforeTo: "2026-09-04",
      month: "2026-10-01",
      beforeMonth: "2026-09-01",
      last: "2026-10-31",
      beforeLast: "2026-09-30",
      whole: false,
    });
    // The 30th of March is set against the 28th of February, the month before's last.
    expect(monthWindow("2027-03-10", "2027-03-30")).toMatchObject({
      to: "2027-03-30",
      beforeTo: "2027-02-28",
      whole: false,
    });
  });

  it("a month that is over, against all of the month before", () => {
    expect(monthWindow("2026-09-15", "2026-10-04")).toMatchObject({
      from: "2026-09-01",
      to: "2026-09-30",
      beforeFrom: "2026-08-01",
      beforeTo: "2026-08-31",
      whole: true,
    });
    // Its last day is a month over: the whole month before.
    expect(monthWindow("2026-10-31", "2026-10-31")).toMatchObject({
      beforeTo: "2026-09-30",
      whole: true,
    });
    // January's month before is December's.
    expect(monthWindow("2027-01-20", "2027-01-20")).toMatchObject({
      beforeFrom: "2026-12-01",
      beforeTo: "2026-12-20",
    });
  });

  // September 2026: Tuesday the 1st. Two Tuesdays sold, one did not open.
  const rows = [
    { day: "2026-09-01", net: 100000, cost: 0, orders: 10 },
    { day: "2026-09-08", net: 0, cost: 0, orders: 0 },
    { day: "2026-09-15", net: 140000, cost: 0, orders: 14 },
    { day: "2026-09-04", net: 300000, cost: 0, orders: 30 },
    { day: "2026-10-01", net: 200000, cost: 0, orders: 20 },
    { day: "2026-10-06", net: 90000, cost: 0, orders: 9 },
  ];

  it("a usual weekday: the days it sold, a day closed no usual day", () => {
    expect(weekdayIndex("2026-09-01")).toBe(1); // Tuesday, Monday first
    expect(weekdayIndex("2026-10-04")).toBe(6); // Sunday
    const usual = usualByWeekday(rows, "2026-09-01", "2026-09-30");
    expect(usual.get(1)).toBe(120000);
    expect(usual.get(4)).toBe(300000); // Friday the 4th
    expect(usual.has(0)).toBe(false);
  });

  it("each day of the month against a usual day of its weekday the month before", () => {
    const w = monthWindow("2026-10-06", "2026-10-06");
    const days = monthDayByDay(rows, w);
    expect(days).toHaveLength(6);
    expect(days[0]).toEqual({ day: "2026-10-01", net: 200000, orders: 20, usual: null }); // Thursday
    expect(days[5]).toEqual({ day: "2026-10-06", net: 90000, orders: 9, usual: 120000 }); // Tuesday
  });

  it("where a month running closes at the pace of its full days", () => {
    // Today, the 6th, is not a full day yet: five full days are too few.
    expect(monthPace(rows, monthWindow("2026-10-06", "2026-10-06"), "2026-10-06")).toBeNull();
    // On the 8th: seven full days sold 290,000, 41,428.57 a day over 31.
    expect(monthPace(rows, monthWindow("2026-10-08", "2026-10-08"), "2026-10-08")).toEqual({
      projected: 1284286,
      days: 7,
    });
    // A month that is over has closed.
    expect(monthPace(rows, monthWindow("2026-09-30", "2026-10-08"), "2026-10-08")).toBeNull();
  });

  it("the weekday that sells, and the one that does not", () => {
    expect(weekdaysApart(usualByWeekday(rows, "2026-09-01", "2026-09-30"))).toEqual({
      best: 4,
      bestNet: 300000,
      worst: 1,
      worstNet: 120000,
    });
    expect(weekdaysApart(new Map([[2, 50000]]))).toBeNull();
    expect(weekdaysApart(new Map())).toBeNull();
  });
});
