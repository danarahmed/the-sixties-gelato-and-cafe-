/** Selling by weight (round seventeen, 0075): a weight typed, and shown. */
import { describe, expect, it } from "vitest";
import { fmtWeight, parseWeight } from "@/lib/weight";

describe("a weight typed at the till", () => {
  it("reads grams and kilos as kilos, to the gram", () => {
    expect(parseWeight("750", "g")?.toString()).toBe("0.75");
    expect(parseWeight("1.2345", "kg")?.toString()).toBe("1.235");
    expect(parseWeight("1,5", "kg")?.toString()).toBe("1.5");
    expect(parseWeight("٢٥٠", "g")?.toString()).toBe("0.25");
  });
  it("refuses what is not a weight it sells", () => {
    expect(parseWeight("", "g")).toBeNull();
    expect(parseWeight("abc", "g")).toBeNull();
    expect(parseWeight("0", "g")).toBeNull();
    expect(parseWeight("0.4", "g")).toBeNull();
    expect(parseWeight("1001", "kg")).toBeNull();
    expect(parseWeight("-5", "g")).toBeNull();
  });
});

describe("a weight shown", () => {
  it("in grams under a kilo, in kilos from one", () => {
    expect(fmtWeight(0.75)).toBe("750 g");
    expect(fmtWeight(0.001)).toBe("1 g");
    expect(fmtWeight(1)).toBe("1 kg");
    expect(fmtWeight(1.25)).toBe("1.25 kg");
  });
});
