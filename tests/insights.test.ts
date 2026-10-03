/**
 * What a period's reports say (src/lib/insights.ts): against the days just
 * before it, as many; where each 1,000 IQD of net revenue went, every account
 * in one part and what was kept the rest; nothing divided by no revenue.
 */
import { describe, expect, it } from "vitest";
import {
  change,
  largestExpense,
  pct,
  pctText,
  previousPeriod,
  spending,
  spentOn,
} from "@/lib/insights";
import type { PnlRow } from "@/lib/db/reports";

const row = (code: string, amount: number): PnlRow => ({
  code,
  name: code,
  section: code.startsWith("4")
    ? "revenue"
    : code.startsWith("5")
      ? "cost_of_sales"
      : "operating_expenses",
  amount,
});

describe("the period before", () => {
  it("is the days just before, as many", () => {
    expect(previousPeriod("2026-10-01", "2026-10-31")).toEqual({
      from: "2026-08-31",
      to: "2026-09-30",
    });
    expect(previousPeriod("2026-10-03", "2026-10-03")).toEqual({
      from: "2026-10-02",
      to: "2026-10-02",
    });
    // Across a year.
    expect(previousPeriod("2026-01-01", "2026-01-07")).toEqual({
      from: "2025-12-25",
      to: "2025-12-31",
    });
  });

  it("is compared as a change, none when there was nothing before", () => {
    expect(change(110, 100)).toBeCloseTo(0.1, 10);
    expect(change(90, 100)).toBeCloseTo(-0.1, 10);
    expect(change(50, 0)).toBeNull();
    expect(change(50, -20)).toBeNull();
  });
});

describe("where each 1,000 IQD went", () => {
  const pnl = [
    row("4000", 1_050_000),
    row("4100", -50_000), // discounts, shown as negative revenue
    row("5000", 380_000),
    row("5100", 60_000),
    row("5200", 20_000),
    row("5300", 15_000),
    row("5310", 5_000),
    row("5400", -2_000), // a count found more than the books
    row("5050", 2_000),
    row("6100", 200_000),
    row("6110", 10_000),
    row("6000", 150_000),
    row("6500", 10_000),
  ];

  it("puts every account in one part", () => {
    expect(spentOn(row("4000", 1))).toBeNull();
    expect(spentOn(row("5000", 1))).toBe("goods");
    expect(spentOn(row("5200", 1))).toBe("platforms");
    expect(spentOn(row("5400", 1))).toBe("waste");
    expect(spentOn(row("5050", 1))).toBe("waste");
    expect(spentOn(row("6110", 1))).toBe("staff");
    expect(spentOn(row("6950", 1))).toBe("running");
  });

  it("divides net revenue, and what was kept is the rest", () => {
    const s = spending(pnl)!;
    expect(s.revenue).toBe(1_000_000);
    expect(Object.fromEntries(s.parts.map((p) => [p.key, p.perThousand]))).toEqual({
      goods: 380,
      platforms: 80,
      waste: 20,
      staff: 210,
      running: 160,
    });
    expect(s.net).toBe(150_000);
    expect(s.netPerThousand).toBe(150);
    expect(s.parts.reduce((t, p) => t + p.perThousand, 0) + s.netPerThousand).toBe(1000);
  });

  it("shows a loss as a loss", () => {
    const s = spending([row("4000", 100_000), row("5000", 60_000), row("6000", 70_000)])!;
    expect(s.net).toBe(-30_000);
    expect(s.netPerThousand).toBe(-300);
  });

  it("divides nothing by no revenue", () => {
    expect(spending([row("6000", 70_000)])).toBeNull();
    expect(spending([])).toBeNull();
  });

  it("names the largest expense", () => {
    expect(largestExpense(pnl)?.code).toBe("6100");
    expect(largestExpense([row("4000", 5)])).toBeNull();
  });

  it("says a share in whole percent, none of nothing", () => {
    expect(pct(124, 1000)).toBe(12);
    expect(pct(5, 0)).toBeNull();
  });

  it("writes a share that rounds to nothing as under 1%, never as 0%", () => {
    expect(pctText(124, 1000)).toBe("12");
    expect(pctText(1350, 3_528_770)).toBe("<1");
    expect(pctText(0, 1000)).toBe("0");
    expect(pctText(5, 0)).toBeNull();
  });
});
