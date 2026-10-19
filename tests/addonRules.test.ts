/**
 * A group of add-ons' rule as three cards (round fourteen): must pick one,
 * optional one, optional several up to a number; any other rule made before
 * kept as its numbers; and the ready-made groups, each with its rule, its
 * choices named in the three languages, Kurdish in Kurdish letters.
 */
import { describe, expect, it } from "vitest";
import { READY_GROUPS, limitsOf, ruleOf } from "@/lib/addonRules";

describe("a group's rule as a card", () => {
  it("reads the fewest and the most as a card", () => {
    expect(ruleOf(1, 1)).toBe("must");
    expect(ruleOf(0, 1)).toBe("one");
    expect(ruleOf(0, 3)).toBe("several");
    expect(ruleOf(0, null)).toBe("several");
    expect(ruleOf(2, 4)).toBe("custom");
    expect(ruleOf(1, null)).toBe("custom");
  });

  it("turns a card back into the fewest and the most", () => {
    expect(limitsOf("must", null)).toEqual({ min: 1, max: 1 });
    expect(limitsOf("one", 5)).toEqual({ min: 0, max: 1 });
    expect(limitsOf("several", 3)).toEqual({ min: 0, max: 3 });
    expect(limitsOf("several", null)).toEqual({ min: 0, max: null });
  });

  it("a card read back is the same card", () => {
    for (const rule of ["must", "one", "several"] as const)
      for (const upTo of [null, 1, 3]) {
        const { min, max } = limitsOf(rule, upTo);
        const back = ruleOf(min, max);
        // Several up to one is the same as optional, one only.
        expect(back).toBe(rule === "several" && upTo === 1 ? "one" : rule);
      }
  });
});

describe("the ready-made groups", () => {
  it("each has its names in three languages and at least one choice", () => {
    expect(READY_GROUPS.map((g) => g.key)).toEqual([
      "milk",
      "shots",
      "syrups",
      "sugar",
      "ice",
      "toppings",
    ]);
    for (const g of READY_GROUPS) {
      expect(g.name && g.nameAr && g.nameCkb).toBeTruthy();
      expect(g.choices.length).toBeGreaterThan(0);
      for (const c of g.choices) expect(c.name && c.nameAr && c.nameCkb).toBeTruthy();
    }
  });

  it("writes Kurdish in Kurdish letters, never Arabic's ك ي ة ى", () => {
    for (const g of READY_GROUPS)
      for (const s of [g.nameCkb, ...g.choices.map((c) => c.nameCkb)])
        expect(s).not.toMatch(/[كيةى]/);
  });

  it("asks for the milk, leaves sugar and ice optional, and fills in only free prices", () => {
    const by = Object.fromEntries(READY_GROUPS.map((g) => [g.key, g]));
    expect(by.milk?.rule).toBe("must");
    expect(by.sugar?.rule).toBe("one");
    expect(by.ice?.rule).toBe("one");
    expect(by.shots?.upTo).toBe(3);
    for (const g of READY_GROUPS)
      for (const c of g.choices) expect(c.price === null || c.price === 0).toBe(true);
  });
});
