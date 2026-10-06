/**
 * The week's schedule checked, and the labour cost against sales (round ten,
 * 0071): the parts of the café's day, an hour's pay from each kind of pay,
 * the hours of a typed week (past midnight too), each part of a day against
 * how busy it usually is, and what the hours on the clock cost a week and a
 * part of the day at a time.
 */
import { describe, expect, it } from "vitest";
import {
  hourlyCost,
  labourActual,
  labourPercent,
  partOf,
  plannedHours,
  weekCheck,
  type Staffing,
} from "@/lib/staffing";

describe("the parts of the café's day", () => {
  it("morning from five, afternoon from noon, evening from five until five", () => {
    expect([4, 5, 11, 12, 16, 17, 23, 0].map(partOf)).toEqual([
      "evening",
      "morning",
      "morning",
      "afternoon",
      "afternoon",
      "evening",
      "evening",
      "evening",
    ]);
  });
});

describe("an hour's pay", () => {
  it("is the hourly rate, a day's over its hours, a month's over 30 days of them", () => {
    expect(hourlyCost({ basis: "hourly", rate: 5000, standardHours: 8 })).toBe(5000);
    expect(hourlyCost({ basis: "daily", rate: 40000, standardHours: 8 })).toBe(5000);
    expect(hourlyCost({ basis: "monthly", rate: 1200000, standardHours: 8 })).toBe(5000);
    expect(hourlyCost({ basis: null, rate: null, standardHours: 8 })).toBeNull();
    expect(hourlyCost(null)).toBeNull();
  });
});

describe("a typed week's hours", () => {
  it("counts each hour, a shift past midnight in the day after", () => {
    const h = plannedHours(
      [
        { employeeId: "a", day: 0, starts: "08:00", ends: "10:30" },
        { employeeId: "b", day: 6, starts: "22:00", ends: "01:00" },
      ],
      (e) => (e === "a" ? 4000 : null),
    );
    expect([...h.keys()]).toEqual(["0|8", "0|9", "0|10", "6|22", "6|23", "7|0"]);
    expect(h.get("0|10")).toEqual({ people: 0.5, cost: 2000, unpriced: 0 });
    expect(h.get("7|0")).toEqual({ people: 1, cost: 0, unpriced: 1 });
  });
});

describe("each part of a day against how busy it usually is", () => {
  // Saturdays: a busy morning (30 orders an hour, 8 to 12), a quiet
  // afternoon (5 an hour, 12 to 5), an evening of 10 an hour (5 to 11).
  const hour = (h: number, orders: number) => ({
    weekday: 0,
    hour: h,
    orders,
    net: orders * 1000,
    people: 0,
    perHead: null,
    flag: null,
  });
  const s: Staffing = {
    hours: [
      ...[8, 9, 10, 11].map((h) => hour(h, 30)),
      ...[12, 13, 14, 15, 16].map((h) => hour(h, 5)),
      ...[17, 18, 19, 20, 21, 22].map((h) => hour(h, 10)),
    ],
    usual: 10,
    busy: 10,
    first: 8,
    last: 22,
    orders: 0,
    unclocked: 0,
    personHours: 0,
    days: [4, 4, 4, 4, 4, 4, 4],
  };
  const week = weekCheck(
    s,
    [
      { employeeId: "a", day: 0, starts: "08:00", ends: "12:00" },
      ...["b", "c", "d"].map((e) => ({ employeeId: e, day: 0, starts: "12:00", ends: "17:00" })),
    ],
    () => 5000,
  );
  const at = (part: string) => week.find((p) => p.day === 0 && p.part === part)!;

  it("one person for thirty orders an hour is short: three are needed", () => {
    expect(at("morning")).toMatchObject({
      orders: 120,
      hours: 4,
      people: 1,
      needed: 3,
      flag: "short",
      cost: 20000,
      net: 120000,
    });
  });

  it("three for five orders an hour stand about", () => {
    expect(at("afternoon")).toMatchObject({ people: 3, needed: 0.5, flag: "quiet" });
  });

  it("an evening that sells with nobody scheduled is said", () => {
    expect(at("evening")).toMatchObject({ people: 0, needed: 1, flag: "nobody", hours: 6 });
  });

  it("a day that sells nothing and has nobody says nothing", () => {
    expect(week.find((p) => p.day === 3 && p.part === "morning")).toMatchObject({
      hours: 0,
      flag: null,
      needed: null,
    });
    expect(week).toHaveLength(21);
  });

  it("the labour share of sales", () => {
    expect(labourPercent(20000, 120000)).toBeCloseTo(16.67, 2);
    expect(labourPercent(5000, 0)).toBeNull();
  });
});

describe("what the hours on the clock cost against sales", () => {
  // The café's clock read as UTC, for the test.
  const local = (at: number) => {
    const d = new Date(at).toISOString();
    return { day: d.slice(0, 10), hour: Number(d.slice(11, 13)) };
  };
  const r = labourActual(
    [
      // Rana, hourly at 5,000: four hours on the 6th, morning.
      { employeeId: "rana", clockIn: "2026-10-06T08:00:00Z", clockOut: "2026-10-06T12:00:00Z" },
      // Dara, pay not set: an evening past midnight, counted the 5th's.
      { employeeId: "dara", clockIn: "2026-10-05T22:00:00Z", clockOut: "2026-10-06T02:00:00Z" },
    ],
    [
      { day: "2026-10-06", hour: 9, net: 80000 },
      { day: "2026-10-06", hour: 1, net: 20000 },
      { day: "2026-09-29", hour: 13, net: 50000 },
    ],
    (e) => (e === "rana" ? 5000 : null),
    "2026-09-23",
    "2026-10-06",
    local,
  );

  it("week by week, ending on the last day", () => {
    expect(r.weeks.map((w) => `${w.from}..${w.to}`)).toEqual([
      "2026-09-23..2026-09-29",
      "2026-09-30..2026-10-06",
    ]);
    expect(r.weeks[1]).toMatchObject({ sales: 100000, cost: 20000, hours: 8, unpriced: 4 });
    expect(r.weeks[1]?.percent).toBe(20);
    expect(r.weeks[0]).toMatchObject({ sales: 50000, cost: 0, percent: 0 });
  });

  it("and by part of the day, after midnight the evening's", () => {
    const part = (p: string) => r.parts.find((x) => x.part === p)!;
    expect(part("morning")).toMatchObject({ sales: 80000, cost: 20000, percent: 25 });
    expect(part("evening")).toMatchObject({ sales: 20000, cost: 0, unpriced: 4 });
    expect(part("afternoon")).toMatchObject({ sales: 50000, hours: 0 });
  });
});
