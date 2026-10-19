/** Barcodes (round twenty, 0078): a scan read, a scale's label read, a code drawn. */
import { describe, expect, it } from "vitest";
import {
  code128Bars,
  code128Symbols,
  ean13Check,
  internalEan13,
  isEan13,
  readScan,
} from "@/lib/barcode";

const items = [
  { variantId: "water", barcode: "6261123456789" },
  { variantId: "cookies", barcode: "10001", soldByWeight: true },
  { variantId: "tea", barcode: null },
];

describe("a scan at the till", () => {
  it("finds the size with that barcode", () => {
    expect(readScan("6261123456789", items)).toEqual({ variantId: "water", kg: null });
    expect(readScan(" 6261123456789 ", items)).toEqual({ variantId: "water", kg: null });
  });
  it("reads a scale's label: the size sold by weight, and the weight", () => {
    const twelve = "201000100750";
    const label = `${twelve}${ean13Check(twelve)}`;
    expect(readScan(label, items)).toEqual({ variantId: "cookies", kg: 0.75 });
  });
  it("finds nothing for a code no size has, or a label whose check digit is wrong", () => {
    expect(readScan("9999999999999", items)).toBeNull();
    const wrong = `201000100750${(ean13Check("201000100750") + 1) % 10}`;
    expect(readScan(wrong, items)).toBeNull();
    expect(readScan("12", items)).toBeNull();
  });
});

describe("EAN-13", () => {
  it("knows its check digit", () => {
    expect(ean13Check("400638133393")).toBe(1);
    expect(isEan13("4006381333931")).toBe(true);
    expect(isEan13("4006381333932")).toBe(false);
  });
  it("makes the café's own, valid, starting 29", () => {
    const c = internalEan13(1234);
    expect(c).toMatch(/^29\d{11}$/);
    expect(isEan13(c)).toBe(true);
  });
});

describe("Code 128", () => {
  it("draws digits two to a symbol, anything else one", () => {
    expect(code128Symbols("1234")).toEqual([105, 12, 34, (105 + 12 * 1 + 34 * 2) % 103, 106]);
    expect(code128Symbols("AB")[0]).toBe(104);
  });
  it("is eleven modules a symbol, the stop thirteen, quiet zones either side", () => {
    const { width } = code128Bars("1234");
    // start + 2 data + check = 4 × 11, stop 13, quiet 10 + 10.
    expect(width).toBe(4 * 11 + 13 + 20);
  });
});
