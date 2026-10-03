/**
 * The end of the day, step by step (src/lib/endofday.ts): the steps done of
 * those shown; the alerts still waiting, money ones whatever their colour;
 * the drawers open and those closed on the day, counted or not; and everyone
 * clocked in, once, wherever the board found them.
 */
import { describe, expect, it } from "vitest";
import type { Alert } from "@/lib/alerts";
import { closedOn, firstFew, openDrawers, progress, stillIn, waitingAlerts } from "@/lib/endofday";

const alert = (over: Partial<Alert>): Alert => ({
  id: over.id ?? "a",
  rule: "running_out",
  subject: "s",
  urgency: "red",
  title: "t",
  why: null,
  action: null,
  confidence: "high",
  link: null,
  firstSeenAt: "2026-10-03T08:00:00Z",
  lastSeenAt: "2026-10-03T08:00:00Z",
  acknowledgedAt: null,
  acknowledgedBy: null,
  ackNote: null,
  snoozedUntil: null,
  snoozedBy: null,
  snoozeReason: null,
  ...over,
});

const session = (over: Partial<Parameters<typeof openDrawers>[0][number]>) => ({
  kind: "session",
  isOpen: false,
  openedAt: "2026-10-03T06:00:00Z",
  closedAt: "2026-10-03T20:00:00Z",
  counted: 100_000,
  variance: 0,
  ...over,
});

describe("the steps", () => {
  it("count those done of those shown, and are ready only when all are", () => {
    expect(progress(["done", "left", "done"])).toEqual({ done: 2, total: 3, ready: false });
    expect(progress(["done", "done"])).toEqual({ done: 2, total: 2, ready: true });
    // Nothing to check is not a day checked.
    expect(progress([])).toEqual({ done: 0, total: 0, ready: false });
  });

  it("show the first few of a list, and how many more", () => {
    expect(firstFew([1, 2, 3, 4, 5])).toEqual({ shown: [1, 2, 3], more: 2 });
    expect(firstFew([1, 2], 3)).toEqual({ shown: [1, 2], more: 0 });
  });
});

describe("the alerts still waiting", () => {
  it("are those nobody answered or snoozed, red apart from orange", () => {
    const w = waitingAlerts([
      alert({ id: "r1" }),
      alert({ id: "r2", acknowledgedAt: "2026-10-03T09:00:00Z" }),
      alert({ id: "r3", snoozedUntil: "2026-10-05" }),
      alert({ id: "o1", urgency: "orange" }),
    ]);
    expect(w.red.map((a) => a.id)).toEqual(["r1"]);
    expect(w.orange.map((a) => a.id)).toEqual(["o1"]);
    expect(w.money).toEqual([]);
  });

  it("put money still to come apart, orange or red", () => {
    const w = waitingAlerts([
      alert({ id: "card", rule: "card_not_banked", urgency: "orange" }),
      alert({ id: "talabat", rule: "platform_not_received" }),
      alert({ id: "late", rule: "platform_not_received", acknowledgedAt: "2026-10-03T09:00:00Z" }),
    ]);
    expect(w.money.map((a) => a.id).sort()).toEqual(["card", "talabat"]);
  });
});

describe("the drawers", () => {
  it("still open are the sessions open, the oldest first", () => {
    const open = openDrawers([
      session({ isOpen: true, closedAt: null, openedAt: "2026-10-03T10:00:00Z" }),
      session({ isOpen: true, closedAt: null, openedAt: "2026-10-03T07:00:00Z" }),
      session({}),
      session({ kind: "drawer", isOpen: true, closedAt: null }),
    ]);
    expect(open.map((s) => s.openedAt)).toEqual(["2026-10-03T07:00:00Z", "2026-10-03T10:00:00Z"]);
  });

  it("closed on a day are counted by the day where the café is, over and short together", () => {
    // Baghdad is three hours ahead: 22:30 the day before is 01:30 on the day.
    const baghdad = (iso: string) =>
      new Date(new Date(iso).getTime() + 3 * 3600_000).toISOString().slice(0, 10);
    const rows = [
      session({ closedAt: "2026-10-02T22:30:00Z", variance: -2_000 }),
      session({ closedAt: "2026-10-03T19:00:00Z", variance: 500 }),
      session({ closedAt: "2026-10-03T12:00:00Z", counted: null, variance: null }),
      session({ closedAt: "2026-10-02T12:00:00Z", variance: -9_000 }),
      session({ isOpen: true, closedAt: null }),
    ];
    expect(closedOn(rows, "2026-10-03", baghdad)).toEqual({
      closed: 3,
      counted: 2,
      difference: -1_500,
    });
  });
});

describe("everyone clocked in", () => {
  it("is listed once, whichever place's board found them, the longest in first", () => {
    const main = [
      { employeeId: "a", name: "Aram", inSince: "2026-10-03T09:00:00Z" },
      { employeeId: "b", name: "Bahar", inSince: null },
    ];
    const kitchen = [
      { employeeId: "a", name: "Aram", inSince: "2026-10-03T09:00:00Z" },
      { employeeId: "c", name: "Chra", inSince: "2026-10-03T06:30:00Z" },
    ];
    expect(stillIn([main, kitchen]).map((p) => p.name)).toEqual(["Chra", "Aram"]);
    expect(stillIn([[]])).toEqual([]);
  });
});
