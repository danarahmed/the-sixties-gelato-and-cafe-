import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import type { PosItem } from "@/lib/db/pos";
import {
  NO_ADDONS_MENU,
  biggerDiscount,
  keepSaleDay,
  quickOrder,
  saleDayDiscount,
  type Line,
  type MoneyRules,
  type Order,
  type TillSaleDay,
} from "@/components/pos/model";

const item = (
  id: string,
  price: number,
  categoryId: string | null,
  extra: Partial<PosItem> = {},
): PosItem => ({
  variantId: id,
  productId: `p-${id}`,
  productName: id,
  variantName: id,
  nameAr: null,
  nameCkb: null,
  category: null,
  categoryId,
  categorySort: null,
  categoryAr: null,
  categoryCkb: null,
  imageUrl: null,
  isFavourite: false,
  prices: { dine_in: price, talabat: price },
  ...extra,
});
const line = (variantId: string, qty: number, extra: Partial<Line> = {}): Line => ({
  key: `${variantId}-${qty}`,
  variantId,
  qty,
  note: null,
  lineId: null,
  fallbackName: null,
  billPrice: null,
  addons: [],
  ...extra,
});
const latte = item("latte", 5000, "coffee");
const cake = item("cake", 4000, "cakes");
const markedDown = item("croissant", 2000, "bakery", { markdownPercent: 50 });
const byId = new Map([latte, cake, markedDown].map((i) => [i.variantId, i]));
const money: MoneyRules = { decimals: 0, discountStep: 500 };
const sd: TillSaleDay = {
  id: "sd",
  name: "Autumn sale",
  percent: 20,
  excludedCategories: [],
  endsAt: null,
};
const order = (lines: Line[], channel: Order["channel"] = "dine_in"): Order => ({
  ...quickOrder(channel),
  lines,
});

describe("sale days at the till (0106)", () => {
  it("takes its percentage off each line's own price, to the business's step", () => {
    const d = saleDayDiscount(order([line("latte", 2)]), byId, money, NO_ADDONS_MENU, sd);
    expect(d).toEqual({ kind: "amount", value: "2000", reason: "sale_day", note: "Autumn sale" });
  });

  it("leaves out the categories it was told to, and what is marked down already", () => {
    const o = order([line("latte", 1), line("cake", 1), line("croissant", 1)]);
    const d = saleDayDiscount(o, byId, money, NO_ADDONS_MENU, {
      ...sd,
      excludedCategories: ["cakes"],
    });
    expect(d?.value).toBe("1000");
  });

  it("never more than its percentage of the bill: down to the step, else as it comes", () => {
    // 10% of 2,500 is 250; the step of 500 would make it 20%: it stays 250.
    const small = item("espresso", 2500, "coffee");
    const m = new Map([[small.variantId, small]]);
    const d = saleDayDiscount(order([line("espresso", 1)]), m, money, NO_ADDONS_MENU, {
      ...sd,
      percent: 10,
    });
    expect(d?.value).toBe("250");
  });

  it("gives nothing on a delivery platform's order, or with no sale day on", () => {
    expect(
      saleDayDiscount(order([line("latte", 1)], "talabat"), byId, money, NO_ADDONS_MENU, sd),
    ).toBeNull();
    expect(
      saleDayDiscount(order([line("latte", 1)]), byId, money, NO_ADDONS_MENU, null),
    ).toBeNull();
  });

  it("follows the lines, and leaves a discount the cashier gave as it is", () => {
    const sale = saleDayDiscount(order([line("latte", 1)]), byId, money, NO_ADDONS_MENU, sd);
    const o = keepSaleDay(order([line("latte", 1)]), sale);
    expect(o.discount?.value).toBe("1000");
    expect(keepSaleDay(o, sale)).toBe(o);
    expect(keepSaleDay(o, null).discount).toBeNull();
    const own = { ...o, discount: { kind: "percent" as const, value: "5", reason: "regular" } };
    expect(keepSaleDay(own, sale)).toBe(own);
  });

  it("the bigger one wins when the money is taken, never both", () => {
    const o = order([line("latte", 1)]);
    const sale = saleDayDiscount(o, byId, money, NO_ADDONS_MENU, sd);
    const subtotal = new Decimal(5000);
    const smaller = { ...o, discount: { kind: "percent" as const, value: "5", reason: "regular" } };
    expect(biggerDiscount(smaller, sale, subtotal, money).discount?.reason).toBe("sale_day");
    const bigger = {
      ...o,
      discount: { kind: "percent" as const, value: "50", reason: "complaint" },
    };
    expect(biggerDiscount(bigger, sale, subtotal, money)).toBe(bigger);
  });
});
