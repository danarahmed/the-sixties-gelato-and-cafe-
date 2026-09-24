/**
 * The small rules the screens depend on: who lands where, what the menu
 * offers each role, how numbers typed in three scripts are read, what a
 * discount at the till comes to, what a new recipe costs and what price that
 * suggests, and when a trading day starts.
 */
import { describe, expect, it } from "vitest";
import { ROLE_PERMISSIONS, type Role } from "@domain/auth/permissions.js";
import { NAV, holdsAny, homeFor, isPublicPath } from "@/lib/auth/routes";
import { addDays, dateIn, monthEnd, monthStart, parseDay } from "@/lib/dates";
import { normaliseNumber, positive, signedNonZero } from "@/lib/validation";
import { getBookkeeper } from "@/lib/bookkeeping/rules";
import Decimal from "decimal.js";
import {
  discountAmount,
  discountInvalid,
  discountParams,
  isDirty,
  orderDue,
  orderSubtotal,
  percentOf,
  quickOrder,
  signature,
  type Discount,
  type MoneyRules,
} from "@/components/pos/model";
import type { PosItem } from "@/lib/db/pos";
import type { SalesChannel } from "@domain/sales/recipe.js";
import {
  channelsFor,
  lineCost,
  margin,
  servingCost,
  suggestedPrice,
  type CostLine,
  type CostedItem,
} from "@/components/menu/recipeCost";
import { SELLABLE_CHANNELS } from "@/lib/format";

const perms = (role: Role) => [...ROLE_PERMISSIONS[role]];

describe("where each role lands", () => {
  const roles = Object.keys(ROLE_PERMISSIONS) as Role[];

  it.each(roles)("%s lands on a screen they may open", (role) => {
    const home = homeFor(perms(role));
    if (home === "/account") return;
    const entry = NAV.find((n) => n.href === home);
    expect(entry, `${home} is not in the navigation`).toBeDefined();
    expect(holdsAny(perms(role), entry!.anyOf)).toBe(true);
  });

  it("a cashier starts at the till and is not offered the books", () => {
    const offered = NAV.filter((n) => holdsAny(perms("cashier"), n.anyOf)).map((n) => n.href);
    expect(homeFor(perms("cashier"))).toBe("/pos");
    expect(offered).toEqual(["/pos"]);
  });

  it("a counter is offered the count and nothing with a cost on it", () => {
    const offered = NAV.filter((n) => holdsAny(perms("inventory_counter"), n.anyOf)).map(
      (n) => n.href,
    );
    expect(offered).toEqual(["/count"]);
  });

  it("only people who manage settings see Settings", () => {
    const settings = NAV.find((n) => n.href === "/settings")!;
    for (const role of roles) {
      expect(holdsAny(perms(role), settings.anyOf)).toBe(
        ROLE_PERMISSIONS[role].has("settings.manage"),
      );
    }
  });

  it("only sign-in and setup are reachable signed out", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/auth/confirm")).toBe(true);
    expect(isPublicPath("/dashboard")).toBe(false);
    expect(isPublicPath("/loginx")).toBe(false);
    expect(isPublicPath("/")).toBe(false);
  });
});

describe("numbers as staff type them", () => {
  it("reads Arabic-Indic and Eastern Arabic-Indic digits", () => {
    expect(normaliseNumber("١٢٬٥٠٠")).toBe("12500");
    expect(normaliseNumber("۲۵۰۰")).toBe("2500");
    expect(normaliseNumber("3٫5")).toBe("3.5");
    expect(normaliseNumber(" 12,500 ")).toBe("12500");
  });

  it("keeps amounts exact, as strings", () => {
    expect(positive("Amount").parse("0.1")).toBe("0.1");
    expect(positive("Amount").parse(25000)).toBe("25000");
  });

  it("refuses zero, negatives and junk where a positive amount is needed", () => {
    expect(positive("Amount").safeParse("0").success).toBe(false);
    expect(positive("Amount").safeParse("-5").success).toBe(false);
    expect(positive("Amount").safeParse("1e3").success).toBe(false);
    expect(positive("Amount").safeParse("abc").success).toBe(false);
  });

  it("takes a signed correction but never zero", () => {
    expect(signedNonZero("Change").parse("-250")).toBe("-250");
    expect(signedNonZero("Change").safeParse("0").success).toBe(false);
  });
});

describe("a discount at the till: the percentage and the amount fill each other in", () => {
  const pct = (value: string): Discount => ({ kind: "percent", value });
  const amt = (value: string): Discount => ({ kind: "amount", value });
  const n = (v: number) => new Decimal(v);
  // A new business rounds a percentage to the nearest 500 IQD; the café, to 250.
  const to500: MoneyRules = { decimals: 0, discountStep: 500 };
  const cafe: MoneyRules = { decimals: 0, discountStep: 250 };
  const off = (d: Discount, subtotal: number, money = to500) =>
    discountAmount(d, n(subtotal), money).toString();

  it("a percentage gives the amount, rounded to the nearest 500 IQD", () => {
    expect(off(pct("47"), 8500)).toBe("4000"); // 3,995: the customer pays 4,500, not 4,505
    expect(off(pct("10"), 5000)).toBe("500");
    expect(off(pct("7"), 5000)).toBe("500"); // 350
    expect(off(pct("5"), 5000)).toBe("500"); // 250, exactly half-way: up
    expect(off(pct("2"), 2500)).toBe("0"); // 50 is nearer nothing
  });

  it("at the café's 250, a percentage comes to the nearest 250 IQD", () => {
    expect(off(pct("47"), 8500, cafe)).toBe("4000"); // 3,995
    expect(off(pct("7"), 5000, cafe)).toBe("250"); // 350
    expect(off(pct("3"), 8500, cafe)).toBe("250"); // 255
    expect(off(pct("5"), 2500, cafe)).toBe("250"); // 125, exactly half-way: up
    expect(off(pct("2"), 2500, cafe)).toBe("0"); // 50 is nearer nothing
  });

  it("an amount typed in is taken as it is: the cashier chose it", () => {
    expect(off(amt("3995"), 8500)).toBe("3995");
    expect(off(amt("300"), 2500)).toBe("300");
  });

  it("with a step of one dinar, a percentage rounds to the dinar, half-way up", () => {
    const dinar: MoneyRules = { decimals: 0, discountStep: 1 };
    expect(off(pct("3"), 1990, dinar)).toBe("60"); // 59.7
    expect(off(pct("12.5"), 2500, dinar)).toBe("313"); // 312.5
    expect(off(pct("47"), 8500, dinar)).toBe("3995");
  });

  it("an amount gives the percentage, to two places", () => {
    expect(percentOf(n(750), n(5000))).toBe("15");
    expect(percentOf(n(333), n(5000))).toBe("6.66");
    expect(percentOf(n(1000), n(3000))).toBe("33.33");
    expect(percentOf(n(500), n(0))).toBe("");
  });

  it("reads what is typed in any of the three scripts", () => {
    expect(off(amt("٧٥٠"), 5000)).toBe("750");
    expect(off(pct("۱۰"), 5000)).toBe("500");
    expect(off(amt("1,000"), 5000)).toBe("1000");
    expect(discountParams(amt("٧٥٠"))).toEqual({ discountPercent: null, discountAmount: "750" });
    expect(discountParams(pct("12.5"))).toEqual({ discountPercent: "12.5", discountAmount: null });
  });

  it("never takes off more than the bill, rounded or not", () => {
    expect(off(amt("9999"), 2500)).toBe("2500");
    expect(off(pct("100"), 2500)).toBe("2500");
    expect(off(pct("90"), 1000)).toBe("1000"); // 900 rounds to 1,000: the whole bill
    expect(off(pct("100"), 1250)).toBe("1250"); // 1,250 would round to 1,500
  });

  it("refuses zero, more than 100% and junk, and sends none of them", () => {
    for (const bad of [pct("0"), pct("100.5"), pct("-5"), amt("0"), amt("abc"), amt("1e3")]) {
      expect(discountInvalid(bad), bad.value).toBe(true);
      expect(off(bad, 5000)).toBe("0");
      expect(discountParams(bad)).toEqual({ discountPercent: null, discountAmount: null });
    }
  });

  it("the customer pays the bill less its discount, and a new discount is a change to save", () => {
    const espresso: PosItem = {
      variantId: "v-espresso",
      productId: "p-espresso",
      productName: "Espresso",
      variantName: "Single",
      nameAr: null,
      nameCkb: null,
      category: null,
      categoryId: null,
      categorySort: null,
      categoryAr: null,
      categoryCkb: null,
      imageUrl: null,
      isFavourite: false,
      prices: { takeaway: 2500 },
    };
    const byId = new Map([[espresso.variantId, espresso]]);
    const lines = [
      {
        key: "l1",
        variantId: espresso.variantId,
        qty: 2,
        note: null,
        lineId: null,
        fallbackName: null,
        fallbackPrice: null,
      },
    ];
    const bill = { ...quickOrder("takeaway"), kind: "bill" as const, lines };
    bill.saved = signature(lines, null);
    expect(orderSubtotal(bill, byId, to500).toString()).toBe("5000");
    expect(isDirty(bill)).toBe(false);

    const discounted = { ...bill, discount: pct("10") };
    expect(orderDue(discounted, byId, to500).toString()).toBe("4500");
    expect(isDirty(discounted)).toBe(true);

    const saved = { ...discounted, saved: signature(lines, discounted.discount) };
    expect(isDirty({ ...saved, discount: pct("10.0") })).toBe(false);
    expect(isDirty({ ...saved, discount: amt("450") })).toBe(true);
  });
});

describe("what a new recipe costs, worked out as it is typed", () => {
  // The golden catalogue of the SQL tests: beans at 10 IQD a gram, cups at 50.
  const beans: CostedItem = {
    id: "beans",
    baseUnit: "g",
    units: [
      { code: "g", factor: 1 },
      { code: "kg", factor: 1000 },
    ],
    unitCost: "10",
  };
  const cup: CostedItem = {
    id: "cup",
    baseUnit: "each",
    units: [
      { code: "each", factor: 1 },
      { code: "sleeve_50", factor: 50 },
    ],
    unitCost: "50",
  };
  const syrup: CostedItem = { id: "syrup", baseUnit: "ml", units: [], unitCost: "0" };
  const at = (unitCost: string): CostedItem => ({ id: "x", baseUnit: "g", units: [], unitCost });
  const items = new Map([beans, cup, syrup].map((i) => [i.id, i]));
  const line = (
    itemId: string,
    quantity: string,
    unit: string,
    channels: SalesChannel[] = [],
  ): CostLine => ({ itemId, quantity, unit, channels });
  const serving = (lines: CostLine[], channel: "dine_in" | "takeaway" | "talabat", map = items) =>
    servingCost(lines, map, channel, 0).toString();

  it("costs the espresso as the database does: 200 at a table, 250 with the takeaway cup", () => {
    const espresso = [
      line("beans", "20", "g"),
      line("cup", "1", "each", channelsFor("to_go", [], SELLABLE_CHANNELS)),
    ];
    expect(serving(espresso, "dine_in")).toBe("200");
    expect(serving(espresso, "takeaway")).toBe("250");
    expect(serving(espresso, "talabat")).toBe("250");
  });

  it("reads a quantity in any of the item's units, and in any of the three scripts", () => {
    expect(serving([line("beans", "0.02", "kg")], "dine_in")).toBe("200");
    expect(serving([line("beans", "٢٠", "g")], "dine_in")).toBe("200");
    expect(lineCost(line("cup", "1", "sleeve_50"), cup, 0)?.toString()).toBe("2500");
  });

  it("adds an item's lines together before rounding it once, as a sale does", () => {
    const x = at("0.3");
    const twice = [line("x", "5", "g"), line("x", "5", "g")];
    expect(lineCost(twice[0]!, x, 0)?.toString()).toBe("2"); // 1.5, to the even dinar
    expect(serving(twice, "dine_in", new Map([["x", x]]))).toBe("3"); // 10 g × 0.3, not 2 + 2
  });

  it("rounds halves to the even dinar, and keeps every digit the database sends", () => {
    expect(lineCost(line("x", "5", "g"), at("0.5"), 0)?.toString()).toBe("2"); // 2.5
    expect(lineCost(line("x", "7", "g"), at("0.5"), 0)?.toString()).toBe("4"); // 3.5
    // 2/3 of a dinar a gram: 0.75 g is 0.5000000000000000000025, just over a half.
    expect(lineCost(line("x", "0.75", "g"), at("0.66666666666666666667"), 0)?.toString()).toBe("1");
  });

  it("counts an item never bought as nothing, and costs no line until it has a quantity", () => {
    expect(lineCost(line("syrup", "10", "ml"), syrup, 0)?.toString()).toBe("0");
    expect(lineCost(line("beans", "", "g"), beans, 0)).toBeNull();
    expect(lineCost(line("beans", "abc", "g"), beans, 0)).toBeNull();
    expect(lineCost(line("beans", "5", "lb"), beans, 0)).toBeNull();
    expect(lineCost(line("", "5", "g"), undefined, 0)).toBeNull();
  });

  it("saves where each line is used: every order, takeaway and delivery, or a table", () => {
    expect(channelsFor("all", [], SELLABLE_CHANNELS)).toEqual([]);
    expect(channelsFor("to_go", [], SELLABLE_CHANNELS)).toEqual([
      "takeaway",
      "direct_delivery",
      "talabat",
      "careem",
      "toters",
    ]);
    expect(channelsFor("dine_in", [], SELLABLE_CHANNELS)).toEqual(["dine_in"]);
    expect(channelsFor("custom", ["talabat"], SELLABLE_CHANNELS)).toEqual(["talabat"]);
    // Every channel ticked, or none, is every order.
    expect(channelsFor("custom", [...SELLABLE_CHANNELS], SELLABLE_CHANNELS)).toEqual([]);
    expect(channelsFor("custom", [], SELLABLE_CHANNELS)).toEqual([]);
  });

  it("shows what a price leaves over the cost", () => {
    const m = margin(new Decimal(4000), new Decimal(1180));
    expect(m.amount.toString()).toBe("2820");
    expect(m.percent?.toFixed(1)).toBe("70.5");
    expect(margin(new Decimal(1000), new Decimal(1180)).amount.toString()).toBe("-180");
    expect(margin(new Decimal(0), new Decimal(1180)).percent).toBeNull();
  });

  it("suggests the lowest round price that leaves the target margin", () => {
    const suggest = (cost: number, target: number, step = 250) =>
      suggestedPrice(new Decimal(cost), new Decimal(target), step)?.toString() ?? null;
    expect(suggest(1180, 70)).toBe("4000"); // 3,933.33 rounded up to 250
    expect(suggest(1200, 70)).toBe("4000"); // exactly 70%
    expect(suggest(1300, 70)).toBe("4500"); // 4,333.33
    expect(suggest(250, 70)).toBe("1000"); // 833.33
    expect(suggest(1180, 70, 500)).toBe("4000");
    expect(suggest(1180, 75)).toBe("4750"); // 4,720
    for (const [cost, target] of [
      [1180, 70],
      [1300, 70],
      [777, 65],
    ] as const) {
      const price = new Decimal(suggest(cost, target)!);
      expect(margin(price, new Decimal(cost)).percent!.gte(target)).toBe(true);
      expect(margin(price.minus(250), new Decimal(cost)).percent!.lt(target)).toBe(true);
    }
    expect(suggest(0, 70)).toBeNull(); // nothing to go by
    expect(suggest(1180, 100)).toBeNull();
    expect(suggest(1180, -5)).toBeNull();
  });
});

describe("the business's own calendar (audit H-09)", () => {
  it("00:30 in Erbil is still the previous day in UTC, but it is today's trading", () => {
    // 2026-09-23 00:30 Asia/Baghdad = 2026-09-22 21:30 UTC.
    const at = new Date("2026-09-22T21:30:00Z");
    expect(dateIn("UTC", at)).toBe("2026-09-22");
    expect(dateIn("Asia/Baghdad", at)).toBe("2026-09-23");
  });

  it("does calendar arithmetic without a timezone", () => {
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(monthStart("2026-09-23")).toBe("2026-09-01");
    expect(monthEnd("2024-02-10")).toBe("2024-02-29");
    expect(parseDay("2026-13-99", "2026-01-01")).toBe("2026-01-01");
    expect(parseDay("not a date", "2026-01-01")).toBe("2026-01-01");
  });
});

describe("expense suggestions", () => {
  const bk = getBookkeeper();

  it("proposes the account from the narration", async () => {
    expect((await bk.categorizeExpense("September shop rent", 400000)).accountCode).toBe("6000");
    expect((await bk.categorizeExpense("generator fuel", 1000)).accountCode).toBe("6200");
  });

  it("never proposes an account an expense may not post to", async () => {
    for (const text of [
      "spoiled milk thrown away",
      "expired cream",
      "talabat commission",
      "something odd",
    ]) {
      const s = await bk.categorizeExpense(text, 1000);
      expect(["5000", "5050", "5300", "5400"]).not.toContain(s.accountCode);
    }
  });

  it("sends stock losses to Inventory instead", async () => {
    const s = await bk.categorizeExpense("spoiled milk thrown away", 1000);
    expect(s.needsReview).toBe(true);
    expect(s.explanation).toMatch(/Inventory/);
  });
});
