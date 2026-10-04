import { describe, expect, it } from "vitest";
import {
  aboutText,
  busiestHour,
  cafeWeekday,
  dayProfile,
  flagOf,
  hourGroups,
  hourText,
  minutesOnClock,
  staffing,
  weekdaysIn,
  type HourSales,
} from "@/lib/staffing";
import { localClock } from "@/lib/dates";

/** A clock a fixed number of minutes ahead of UTC. */
const ahead =
  (minutes: number) =>
  (at: number): { day: string; hour: number } => {
    const d = new Date(at + minutes * 60_000);
    return { day: d.toISOString().slice(0, 10), hour: d.getUTCHours() };
  };

describe("staffed when busy? (round six)", () => {
  it("the café's week starts on Saturday, as the sales analysis counts it", () => {
    expect(cafeWeekday("2026-10-03")).toBe(0); // a Saturday
    expect(cafeWeekday("2026-10-04")).toBe(1); // Sunday
    expect(cafeWeekday("2026-10-02")).toBe(6); // Friday
    expect(weekdaysIn("2026-09-05", "2026-10-02")).toEqual([4, 4, 4, 4, 4, 4, 4]);
    expect(weekdaysIn("2026-10-03", "2026-10-04")).toEqual([1, 1, 0, 0, 0, 0, 0]);
  });

  it("each stretch on the clock falls in the hours the café's clock showed", () => {
    const m = minutesOnClock(
      [
        // Saturday 09:30 to 12:15 in Baghdad.
        { clockIn: "2026-10-03T06:30:00Z", clockOut: "2026-10-03T09:15:00Z" },
        // Friday 23:30 to Saturday 00:30: only Saturday's half hour is in the days read.
        { clockIn: "2026-10-02T20:30:00Z", clockOut: "2026-10-02T21:30:00Z" },
        // Out before in: nothing.
        { clockIn: "2026-10-03T10:00:00Z", clockOut: "2026-10-03T09:00:00Z" },
      ],
      "2026-10-03",
      "2026-10-03",
      ahead(180),
    );
    expect(Object.fromEntries(m)).toEqual({
      "0|0": 30,
      "0|9": 30,
      "0|10": 60,
      "0|11": 60,
      "0|12": 15,
    });
  });

  it("a zone half an hour off the hour is cut at its own hours", () => {
    const m = minutesOnClock(
      [{ clockIn: "2026-10-03T04:00:00Z", clockOut: "2026-10-03T05:00:00Z" }],
      "2026-10-03",
      "2026-10-03",
      ahead(330),
    );
    expect(Object.fromEntries(m)).toEqual({ "0|9": 30, "0|10": 30 });
  });

  it("the business's clock, as the browser's time zones have it", () => {
    const baghdad = localClock("Asia/Baghdad");
    expect(baghdad(Date.parse("2026-10-03T21:30:00Z"))).toEqual({ day: "2026-10-04", hour: 0 });
    expect(baghdad(Date.parse("2026-10-03T06:59:00Z"))).toEqual({ day: "2026-10-03", hour: 9 });
  });

  // Four of each weekday, each cell's orders and minutes over all four.
  const from = "2026-09-05";
  const to = "2026-10-02";
  const sales: HourSales[] = [
    { weekday: 6, hour: 20, orders: 48, net: 480_000 }, // Friday evening: one on the clock
    { weekday: 6, hour: 21, orders: 40, net: 400_000 },
    { weekday: 0, hour: 10, orders: 4, net: 40_000 }, // Saturday morning: three on the clock
    { weekday: 0, hour: 11, orders: 16, net: 160_000 },
    { weekday: 1, hour: 12, orders: 24, net: 240_000 },
    { weekday: 2, hour: 22, orders: 4, net: 40_000 }, // Monday night: nobody clocked in
    { weekday: 3, hour: 23, orders: 1, net: 10_000 }, // once in four Tuesdays: not said
  ];
  const minutes = new Map([
    ["6|20", 240],
    ["6|21", 240],
    ["0|10", 720],
    ["0|11", 480],
    ["1|12", 480],
  ]);
  const s = staffing(sales, minutes, from, to);

  it("what a person on the clock usually serves, and the busier half of the hours", () => {
    // 132 orders served with someone on the clock, over 36 hours on the clock.
    expect(s.usual).toBeCloseTo(132 / 36, 6);
    expect(s.personHours).toBe(36);
    expect(s.orders).toBe(137);
    expect(s.unclocked).toBe(5);
    // The middle of 0.25, 1, 1, 4, 6, 10 and 12 orders a day.
    expect(s.busy).toBe(4);
    expect([s.first, s.last]).toEqual([10, 23]);
  });

  it("each hour a day on average, and marked", () => {
    const at = (w: number, h: number) => s.hours.find((x) => x.weekday === w && x.hour === h)!;
    expect(at(6, 20)).toMatchObject({
      orders: 12,
      net: 120_000,
      people: 1,
      perHead: 12,
      flag: "short",
    });
    expect(at(6, 21).flag).toBe("short");
    expect(at(0, 10)).toMatchObject({ orders: 1, people: 3, flag: "quiet" });
    // Two on the clock serving two each: not quiet enough to say.
    expect(at(0, 11).flag).toBeNull();
    expect(at(1, 12).flag).toBeNull();
    expect(at(2, 22)).toMatchObject({ people: 0, perHead: null, flag: "nobody" });
    expect(at(3, 23).flag).toBeNull();
    // Saturday first, then by the hour.
    expect(s.hours.map((h) => `${h.weekday}|${h.hour}`)).toEqual([
      "0|10",
      "0|11",
      "1|12",
      "2|22",
      "3|23",
      "6|20",
      "6|21",
    ]);
  });

  it("the marks as said: a weekday's run of hours as one, the weightiest first", () => {
    const g = hourGroups(s);
    expect(g.map((x) => [x.flag, x.weekday, x.from, x.to])).toEqual([
      ["short", 6, 20, 22],
      ["quiet", 0, 10, 11],
      ["nobody", 2, 22, 23],
    ]);
    expect(g[0]).toMatchObject({ orders: 11, people: 1 });
    // The orders above what one person usually serves, both hours added.
    expect(g[0]!.weight).toBeCloseTo(22 - 2 * (132 / 36), 6);
    // Three on the clock, where the one order a day needed a quarter of one.
    expect(g[1]!.weight).toBeCloseTo(3 - 1 / (132 / 36), 6);
    expect(busiestHour(s)).toMatchObject({ weekday: 6, hour: 20 });
  });

  it("a day hour by hour: a weekday's, or every day's on average", () => {
    const friday = dayProfile(s, 6);
    expect(friday.map((h) => h.hour)).toEqual([
      10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23,
    ]);
    const eight = friday.find((h) => h.hour === 20)!;
    expect(eight).toMatchObject({ orders: 12, people: 1, flag: "short" });
    expect(eight.expected).toBeCloseTo(132 / 36, 6);
    expect(friday.find((h) => h.hour === 10)).toMatchObject({ orders: 0, people: 0, flag: null });
    const every = dayProfile(s, null);
    const evening = every.find((h) => h.hour === 20)!;
    expect(evening.orders).toBeCloseTo(48 / 28, 6);
    expect(evening.people).toBeCloseTo(4 / 28, 6);
    // An average day's hours are marked among themselves: its evening is still short of hands.
    expect(every.filter((h) => h.flag === "short").map((h) => h.hour)).toEqual([20, 21]);
    expect(every.find((h) => h.hour === 22)!.flag).toBeNull();
  });

  it("nobody on the clock is said from half an order a day; the usual is needed for the rest", () => {
    expect(flagOf(0.4, 0, 3, 1)).toBeNull();
    expect(flagOf(0.5, 0, 3, 1)).toBe("nobody");
    expect(flagOf(10, 1, null, 1)).toBeNull();
    // Busy enough and each serving half as much again: short; not among the busier half: not.
    expect(flagOf(6, 1, 4, 5)).toBe("short");
    expect(flagOf(6, 1, 4, 7)).toBeNull();
    // One on the clock is never quiet: one fewer is nobody.
    expect(flagOf(0.1, 1, 4, 1)).toBeNull();
  });

  it("no orders and nobody on the clock: nothing to say", () => {
    const none = staffing([], new Map(), from, to);
    expect(none).toMatchObject({ hours: [], usual: null, first: null, last: null, orders: 0 });
    expect(dayProfile(none, null)).toEqual([]);
    expect(hourGroups(none)).toEqual([]);
    expect(busiestHour(none)).toBeNull();
  });

  it("hours and figures as said", () => {
    expect(hourText(9)).toBe("09:00");
    expect(hourText(24)).toBe("00:00");
    expect(aboutText(4.56)).toBe("4.6");
    expect(aboutText(4)).toBe("4");
    expect(aboutText(12.4)).toBe("12");
    expect(aboutText(1234.5)).toBe("1,235");
  });
});
