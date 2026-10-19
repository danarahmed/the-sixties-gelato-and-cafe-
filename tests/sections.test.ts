/**
 * The café's and the bakery's takings and profit told apart (round sixteen,
 * 0074): each category counted in its section, refunds taken off, what is of
 * no section apart and last.
 */
import { describe, expect, it } from "vitest";
import { bySection } from "@/lib/sections";

const row = (key: string, kept: number, cost: number, costBack = 0) => ({
  key,
  kept,
  cost,
  costBack,
});
const sections = [
  { id: "bakery", name: "Bakery", position: 2 },
  { id: "cafe", name: "Café", position: 1 },
];

describe("takings and profit by section", () => {
  it("adds up each section's categories, in the sections' order", () => {
    const out = bySection(
      [row("coffee", 60000, 15000), row("tea", 20000, 4000), row("cakes", 20000, 9000, 1000)],
      { coffee: "cafe", tea: "cafe", cakes: "bakery" },
      sections,
      "No section",
    );
    expect(out.map((s) => [s.name, s.sales, s.cost, s.profit, s.share, s.margin])).toEqual([
      ["Café", 80000, 19000, 61000, 80, 76.3],
      ["Bakery", 20000, 8000, 12000, 20, 60],
    ]);
  });

  it("counts a category of no section, and one of a section gone, apart and last", () => {
    const out = bySection(
      [row("coffee", 3000, 1000), row("none", 1000, 500), row("old", 1000, 0)],
      { coffee: "cafe", old: "gone" },
      sections,
      "No section",
    );
    expect(out.map((s) => [s.id, s.sales])).toEqual([
      ["cafe", 3000],
      [null, 2000],
    ]);
  });

  it("says nothing of a section that sold nothing, and no margin on no sales", () => {
    expect(bySection([], {}, sections, "No section")).toEqual([]);
    expect(
      bySection([row("cakes", 0, 0)], { cakes: "bakery" }, sections, "x")[0]?.margin,
    ).toBeNull();
  });
});
