/**
 * The menu matrix (round eleven): each product by what it sells against what
 * it earns on each one, in four groups, with the raise that brings a product
 * that sells a lot up to the menu's average.
 */
import { describe, expect, it } from "vitest";
import type { AnalysisRow } from "@/lib/analysis";
import { MENU_MATRIX_PHRASES, menuMatrix, raiseWorth, roundUp } from "@/lib/menuMatrix";
import { builtInWords } from "@/lib/i18n/dictionaries";

const row = (key: string, qty: number, kept: number, cost: number): AnalysisRow => ({
  key,
  names: { en: key },
  key2: null,
  names2: null,
  orders: qty,
  qty,
  gross: kept,
  discount: 0,
  net: kept,
  cost,
  margin: kept - cost,
  refunded: 0,
  costBack: 0,
  kept,
  marginKept: kept - cost,
  lines: 0,
  paid: 0,
});

describe("the menu matrix", () => {
  // 400 items sold over four products: an even share is 100, so 70 sells a lot.
  // Earned: 300×1,000 + 50×3,000 + 40×500 + 10×2,000 = 490,000: 1,225 on each.
  const rows = [
    row("Latte", 300, 300 * 3500, 300 * 2500), // sells a lot, 1,000 each
    row("Pistachio cup", 50, 50 * 5000, 50 * 2000), // few, 3,000 each
    row("Water", 40, 40 * 1000, 40 * 500), // few, 500 each
    row("Affogato", 10, 10 * 6000, 10 * 4000), // few, 2,000 each
  ];

  it("cuts by 70% of an even share sold and the menu's average earning", () => {
    const m = menuMatrix(rows);
    expect(m.sold).toBe(400);
    expect(m.popular).toBe(70);
    expect(m.average).toBe(1225);
    const group = Object.fromEntries(m.items.map((i) => [i.key, i.group]));
    expect(group).toEqual({
      Latte: "raise",
      "Pistachio cup": "promote",
      Affogato: "promote",
      Water: "rethink",
    });
  });

  it("puts a product that sells a lot and earns well in keep", () => {
    const m = menuMatrix([...rows, row("Mango cup", 200, 200 * 6000, 200 * 3000)]);
    expect(m.items.find((i) => i.key === "Mango cup")?.group).toBe("keep");
    expect(m.items[0]?.key).toBe("Mango cup");
  });

  it("says by how much to raise, rounded up to 250 IQD, and what that brings", () => {
    const m = menuMatrix(rows);
    const latte = m.items.find((i) => i.key === "Latte")!;
    expect(latte.perItem).toBe(1000);
    expect(latte.raiseBy).toBe(250); // 225 short of the average, rounded up
    expect(raiseWorth(m)).toBe(250 * 300);
    expect(m.items.find((i) => i.key === "Water")?.raiseBy).toBeNull();
    expect(roundUp(0)).toBe(0);
    expect(roundUp(251)).toBe(500);
  });

  it("leaves out what was sold with no cost, and names it", () => {
    const m = menuMatrix([...rows, row("Special", 20, 20 * 4000, 0), row("Nothing", 0, 0, 0)]);
    expect(m.items.map((i) => i.key)).not.toContain("Special");
    expect(m.noCost).toEqual([{ key: "Special", names: { en: "Special" }, sold: 20 }]);
    expect(m.sold).toBe(400);
  });

  it("has nothing to compare with fewer than two products", () => {
    expect(menuMatrix(rows.slice(0, 1)).items).toEqual([]);
    expect(menuMatrix([]).items).toEqual([]);
  });

  it("puts each group's most sold first, in the groups' order", () => {
    const m = menuMatrix(rows);
    expect(m.items.map((i) => i.key)).toEqual(["Latte", "Pistachio cup", "Affogato", "Water"]);
  });

  it("has every word of the matrix in Arabic and Kurdish", () => {
    for (const locale of ["ar", "ckb"] as const) {
      const words = builtInWords(locale);
      expect(
        MENU_MATRIX_PHRASES.filter((p) => !words[p]),
        locale,
      ).toEqual([]);
    }
  });
});
