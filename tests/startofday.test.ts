import { describe, expect, it } from "vitest";
import { deliveriesDue, dueIn, isMorning, toMake } from "@/lib/startofday";

const person = (
  employeeId: string,
  name: string,
  shiftStarts: string | null,
  inSince: string | null = null,
) => ({ employeeId, name, shiftStarts, inSince });

describe("the start of the day, step by step (round four)", () => {
  const now = new Date("2026-10-04T06:30:00Z"); // 09:30 in Baghdad

  it("who is due in: in, late and later, each once", () => {
    const branch = [
      person("a", "Aram", "2026-10-04T05:00:00Z", "2026-10-04T04:58:00Z"),
      person("b", "Bawan", "2026-10-04T06:00:00Z"),
      person("c", "Chiman", "2026-10-04T05:30:00Z"),
      person("d", "Dana", "2026-10-04T11:00:00Z"),
      person("e", "Ehsan", null),
    ];
    // The kitchen's board has Bawan in: in at one place counts.
    const kitchen = [person("b", "Bawan", "2026-10-04T06:00:00Z", "2026-10-04T06:05:00Z")];
    const due = dueIn([branch, kitchen], now);
    expect(due.inNow.map((p) => p.name).sort()).toEqual(["Aram", "Bawan"]);
    expect(due.late.map((p) => p.name)).toEqual(["Chiman"]);
    expect(due.later.map((p) => p.name)).toEqual(["Dana", "Ehsan"]);
  });

  it("the longest waited for first; nobody working, nothing due", () => {
    const late = dueIn(
      [[person("x", "Xan", "2026-10-04T06:15:00Z"), person("y", "Yad", "2026-10-04T05:15:00Z")]],
      now,
    ).late;
    expect(late.map((p) => p.name)).toEqual(["Yad", "Xan"]);
    expect(dueIn([], now)).toEqual({ inNow: [], late: [], later: [] });
  });

  it("what to make: batches to make, the most first", () => {
    const plan = [
      { recipe: "Vanilla", status: "make" as const, batches: 1 },
      { recipe: "Pistachio", status: "make" as const, batches: 3 },
      { recipe: "Lemon", status: "enough" as const, batches: 0 },
      { recipe: "Mango", status: "no_history" as const, batches: 0 },
      { recipe: "Cocoa", status: "make" as const, batches: 1 },
    ];
    expect(toMake(plan).map((r) => r.recipe)).toEqual(["Pistachio", "Cocoa", "Vanilla"]);
  });

  it("the deliveries due: open orders expected by the day, the late first", () => {
    const orders = [
      { poNo: 4, status: "sent", expectedOn: "2026-10-04" },
      { poNo: 2, status: "approved", expectedOn: "2026-10-02" },
      { poNo: 5, status: "sent", expectedOn: "2026-10-05" },
      { poNo: 6, status: "draft", expectedOn: "2026-10-03" },
      { poNo: 7, status: "closed", expectedOn: "2026-10-01" },
      { poNo: 8, status: "sent", expectedOn: null },
    ];
    expect(deliveriesDue(orders, "2026-10-04").map((o) => o.poNo)).toEqual([2, 4]);
  });

  it("offered in the morning: from four until noon", () => {
    expect([3, 4, 9, 11, 12, 16].map(isMorning)).toEqual([false, true, true, true, false, false]);
  });
});
