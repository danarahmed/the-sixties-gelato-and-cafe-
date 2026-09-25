/**
 * The small rules the screens depend on: who lands where, what the menu
 * offers each role, how numbers typed in three scripts are read, what a
 * discount at the till comes to, what a new recipe costs and what price that
 * suggests, what a batch uses and costs, when a trading day starts, what the
 * drawer count shows before it is posted, and when a failed call is a refusal
 * and when it is an unknown.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ROLE_PERMISSIONS, type Role } from "@domain/auth/permissions.js";
import { NAV, holdsAny, homeFor, isPublicPath } from "@/lib/auth/routes";
import { addDays, dateIn, dayStart, monthEnd, monthStart, parseDay } from "@/lib/dates";
import { normaliseNumber, positive, signedNonZero } from "@/lib/validation";
import { getBookkeeper } from "@/lib/bookkeeping/rules";
import { isUncertainFailure } from "@/lib/db/rpcOutcome";
import { drawerPreview } from "@/components/books/drawerMath";
import { salesTotals } from "@/lib/db/salesTotals";
import {
  AUDIT_GROUPS,
  actionLabel,
  auditGroup,
  describeChanges,
  showValue,
  subjectOf,
} from "@/lib/audit";
import { deliveryLineCost, needsPriceConfirmation, priceGap } from "@/lib/receiving";
import { REASONS, noteIsEnough, reasonKey, reasonMissing, type ReasonKind } from "@/lib/reasons";
import { LOCALES, getDictionary } from "@/lib/i18n/dictionaries";
import { exceptionsByPerson, type ExceptionRow } from "@/lib/exceptions";
import Decimal from "decimal.js";
import {
  addLine,
  approvalPercent,
  approvalRefused,
  billChanged,
  discountAmount,
  discountInvalid,
  discountNeeds,
  discountParams,
  discountShare,
  discountWhy,
  isDirty,
  orderDue,
  orderFromBill,
  orderSubtotal,
  percentOf,
  quickOrder,
  signature,
  type Discount,
  type MoneyRules,
} from "@/components/pos/model";
import type { OpenBill, PosItem } from "@/lib/db/pos";
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
import {
  batchCost,
  batchesOf,
  perUnit,
  showIn,
  unitFactor,
} from "@/components/production/batchMath";
import { filledLines, halfFilled, linesFrom, newLine } from "@/components/menu/RecipeLines";

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

  it("the audit trail is offered to those who may read it, and no one else", () => {
    const audit = NAV.find((n) => n.href === "/audit")!;
    const offered = roles.filter((r) => holdsAny(perms(r), audit.anyOf)).sort();
    expect(offered).toEqual(
      ["accountant", "auditor", "branch_manager", "general_manager", "owner"].sort(),
    );
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
        billPrice: null,
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

describe("a printed bill is paid at the prices the customer was shown (0025)", () => {
  const money: MoneyRules = { decimals: 0, discountStep: 500 };
  // The menu has moved on to 3,000; the bill was printed at 2,500.
  const latte: PosItem = {
    variantId: "v-latte",
    productId: "p-latte",
    productName: "Latte",
    variantName: "Latte",
    nameAr: null,
    nameCkb: null,
    category: null,
    categoryId: null,
    categorySort: null,
    categoryAr: null,
    categoryCkb: null,
    imageUrl: null,
    isFavourite: false,
    prices: { dine_in: 3000 },
  };
  const byId = new Map([[latte.variantId, latte]]);
  const printed: OpenBill = {
    tabId: "t1",
    version: 3,
    tableId: null,
    tableName: null,
    label: "Table 4",
    channel: "dine_in",
    businessDay: "2026-09-25",
    openedAt: "2026-09-25T18:00:00Z",
    openedBy: null,
    billPrintedAt: "2026-09-25T19:00:00Z",
    billPrintCount: 1,
    lines: [
      {
        lineId: "l1",
        variantId: latte.variantId,
        qty: 2,
        note: "oat milk",
        productName: "Latte",
        variantName: "Latte",
        price: 2500,
      },
    ],
    subtotal: 5000,
    discount: 0,
    discountPercent: null,
    discountAmount: null,
    total: 5000,
  };

  it("the bill shows, and the till asks for, its printed total", () => {
    const o = orderFromBill(printed);
    expect(orderDue(o, byId, money).toFixed()).toBe("5000");
  });

  it("one more of the same is at the printed price too, as the database adds it", () => {
    const o = orderFromBill(printed);
    // The printed line has a note, so the new one is a line of its own.
    const more = { ...o, lines: addLine(o.lines, latte.variantId) };
    expect(more.lines).toHaveLength(2);
    expect(orderDue(more, byId, money).toFixed()).toBe("7500");
  });

  it("a bill on screen is replaced when another till changed it, or a price on it did", () => {
    const o = orderFromBill(printed);
    expect(billChanged(o, printed)).toBe(false);
    expect(billChanged(o, { ...printed, version: 4 })).toBe(true);
    expect(billChanged(o, { ...printed, billPrintCount: 2 })).toBe(true);
    // Not yet printed, and a new price started at midnight.
    const open = { ...printed, billPrintedAt: null, billPrintCount: 0 };
    const shown = orderFromBill(open);
    const repriced = { ...open, lines: [{ ...open.lines[0]!, price: 3000 }] };
    expect(billChanged(shown, repriced)).toBe(true);
    expect(orderDue(orderFromBill(repriced), byId, money).toFixed()).toBe("6000");
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

describe("a batch, as the production form shows it before it is recorded", () => {
  // The SQL test's figures: milk at 1.5 a ml and sugar at 1.2 a g make the base;
  // the base at 1.392 a ml and paste at 30 a g make the pistachio gelato.
  const cost: Record<string, string> = { milk: "1.5", sugar: "1.2", base: "1.392", paste: "30" };
  const costOf = (id: string) => cost[id] ?? "0";
  const gelato = {
    baseUnit: "g",
    units: [
      { code: "g", label: "g", factor: 1 },
      { code: "kg", label: "kg", factor: 1000 },
      { code: "pan", label: "Pan", factor: 5000 },
    ],
  };

  it("costs the ingredients as the database posts them", () => {
    const base = [
      { itemId: "milk", baseQty: 4000 },
      { itemId: "sugar", baseQty: 800 },
    ];
    expect(batchCost(base, new Decimal(2), costOf, 0).toString()).toBe("13920");
    const pistachio = [
      { itemId: "base", baseQty: 4500 },
      { itemId: "paste", baseQty: 500 },
    ];
    expect(batchCost(pistachio, new Decimal(1), costOf, 0).toString()).toBe("21264");
  });

  it("adds an item's lines together before rounding it once", () => {
    const twice = [
      { itemId: "x", baseQty: 5 },
      { itemId: "x", baseQty: 5 },
    ];
    expect(batchCost(twice, new Decimal(1), () => "0.3", 0).toString()).toBe("3"); // not 2 + 2
  });

  it("shows what came out in any of the item's units", () => {
    expect(unitFactor(gelato, "pan")).toBe(5000);
    expect(unitFactor(gelato, "tray")).toBeNull();
    expect(showIn(new Decimal(4600), gelato, "kg")).toBe("4.6 kg");
    expect(showIn(new Decimal(5000), gelato, "pan")).toBe("1 Pan");
    expect(showIn(new Decimal(4600), gelato, "g")).toBe("4,600 g");
  });

  it("gives the cost of each unit made", () => {
    expect(perUnit(new Decimal(21264), new Decimal(4.6), "kg")).toBe("4,623 IQD per kg");
    expect(perUnit(new Decimal(13920), new Decimal(10000), "ml")).toBe("1.39 IQD per ml");
    expect(perUnit(new Decimal(100), new Decimal(0), "kg")).toBeNull();
  });

  it("reads the number of batches in any script, and only above zero", () => {
    expect(batchesOf("2")?.toString()).toBe("2");
    expect(batchesOf("٢")?.toString()).toBe("2");
    expect(batchesOf("0.5")?.toString()).toBe("0.5");
    expect(batchesOf("0")).toBeNull();
    expect(batchesOf("abc")).toBeNull();
  });
});

describe("a recipe, reopened to change it", () => {
  it("reads each line's channels back as the choice they came from", () => {
    const lines = linesFrom([
      { itemId: "beans", quantity: 18, unitCode: "g", channels: null },
      {
        itemId: "cup",
        quantity: 1,
        unitCode: "each",
        channels: ["takeaway", "direct_delivery", "talabat", "careem", "toters"],
      },
      { itemId: "saucer", quantity: 1, unitCode: "each", channels: ["dine_in"] },
      { itemId: "lid", quantity: 1, unitCode: "each", channels: ["takeaway", "talabat"] },
      { itemId: "milk", quantity: 1000, unitCode: "ml" },
    ]);
    expect(lines.map((l) => l.use)).toEqual(["all", "to_go", "dine_in", "custom", "all"]);
    expect(lines[3]!.ticked).toEqual(["takeaway", "talabat"]);
    expect(lines[4]!.quantity).toBe("1000"); // no thousands separator in a box to edit
    expect(new Set(lines.map((l) => l.key)).size).toBe(5);
  });

  it("stops at a half-filled line and sends only whole ones", () => {
    const blank = newLine();
    const half = { ...newLine(), itemId: "beans", unit: "g" };
    const whole = { ...newLine(), itemId: "cup", quantity: "1", unit: "each" };
    expect(halfFilled([whole, blank])).toBe(-1);
    expect(halfFilled([whole, half])).toBe(1);
    expect(filledLines([whole, blank])).toEqual([
      { itemId: "cup", qty: "1", unitCode: "each", channels: [] },
    ]);
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

  it("a trading day starts at midnight in Erbil: 21:00 UTC the day before", () => {
    expect(dayStart("2026-09-25", "Asia/Baghdad")).toBe("2026-09-24T21:00:00.000Z");
    expect(dayStart("2026-01-01", "UTC")).toBe("2026-01-01T00:00:00.000Z");
    // Across a change of clocks, still local midnight.
    expect(dayStart("2026-03-29", "Europe/London")).toBe("2026-03-29T00:00:00.000Z");
    expect(dayStart("2026-03-30", "Europe/London")).toBe("2026-03-29T23:00:00.000Z");
  });
});

describe("sales by channel, net of refunds (audit P1-2)", () => {
  it("refunds come off sales, and the cost of what went back on the shelf off the cost", () => {
    // Two takeaway espressos refunded (made drinks do not go back), and a
    // bottle of water refunded to the shelf: the SQL test's day.
    const t = salesTotals([
      { net: 5000, cogs: 500, refunds: 5000, returnedCost: 0 },
      { net: 3500, cogs: 450, refunds: 1000, returnedCost: 250 },
    ]);
    expect(t).toEqual({ sold: 8500, refunds: 6000, net: 2500, cost: 700, margin: 1800 });
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

describe("the drawer count, as the form shows it before it is posted (0024)", () => {
  const status = { start: 25000, startTyped: "", moved: 4000 };
  it("expects what the last count left plus every movement since", () => {
    expect(drawerPreview({ ...status, counted: "", left: "" }).expected).toBe(29000);
  });
  it("is short or over by the difference", () => {
    const p = drawerPreview({ ...status, counted: "28,500", left: "25000" });
    expect(p.variance).toBe(-500);
    expect(p.left).toBe(25000);
    expect(p.taken).toBe(3500);
  });
  it("keeps everything in the drawer when nothing is said", () => {
    const p = drawerPreview({ ...status, counted: "29000", left: "" });
    expect(p.variance).toBe(0);
    expect(p.taken).toBe(0);
  });
  it("refuses to leave more than was counted", () => {
    expect(drawerPreview({ ...status, counted: "1000", left: "2000" }).error).toMatch(/between 0/);
  });
  it("reads the counted cash typed in Arabic-Indic digits", () => {
    expect(drawerPreview({ ...status, counted: "٢٩٠٠٠", left: "" }).variance).toBe(0);
  });
  it("after days closed the old way, starts from the cash typed", () => {
    const first = { start: null, startTyped: "", moved: 4000 };
    expect(drawerPreview({ ...first, counted: "5000", left: "" }).expected).toBeNull();
    expect(
      drawerPreview({ ...first, startTyped: "1000", counted: "5000", left: "" }).variance,
    ).toBe(0);
  });
});

describe("a failed database call: a refusal, or an unknown (audit P0-4)", () => {
  it("a function the database ran and refused is a refusal: nothing was saved", () => {
    expect(isUncertainFailure({ code: "P0001", message: "Enter the cash you counted" }, 400)).toBe(
      false,
    );
    expect(isUncertainFailure({ code: "42501", message: "permission denied" }, 403)).toBe(false);
    expect(isUncertainFailure({ code: "23505", message: "duplicate" }, 409)).toBe(false);
  });
  it("no answer at all is an unknown: it may have been saved", () => {
    expect(isUncertainFailure({ code: "", message: "TypeError: fetch failed" }, 0)).toBe(true);
    expect(isUncertainFailure({ message: "FetchError: timeout" }, undefined)).toBe(true);
  });
  it("a gateway that gave up is an unknown", () => {
    expect(isUncertainFailure({ code: "", message: "Bad gateway" }, 502)).toBe(true);
    expect(isUncertainFailure({ code: "", message: "Gateway timeout" }, 504)).toBe(true);
    expect(isUncertainFailure({ code: "PGRST001", message: "connection" }, 503)).toBe(true);
  });
  it("no error is no failure", () => {
    expect(isUncertainFailure(null, 200)).toBe(false);
  });
});

describe("the audit trail in words (0027, the audit's P1-1)", () => {
  const V = "d1000000-0000-0000-0000-000000000001";
  const I = "c0000000-0000-0000-0000-000000000001";
  const names = new Map([
    [V, "Espresso — Single"],
    [I, "Coffee beans"],
  ]);

  it("names what happened, including changes the database records itself", () => {
    expect(actionLabel("price.set")).toBe("Price set");
    expect(actionLabel("item.update")).toBe("Stock item changed");
    expect(actionLabel("supplier.create")).toBe("Supplier added");
    expect(actionLabel("product_category.delete")).toBe("Category deleted");
    expect(actionLabel("something.new")).toBe("something.new");
  });

  it("a price set: what it was and what it became, about the product and channel", () => {
    const before = { price: 2500, channel: "dine_in", variant: V };
    const after = { price: 3000, channel: "dine_in", variant: V, effective_from: "2026-09-25" };
    expect(describeChanges(before, after, names)).toEqual([
      { field: "Price", before: "2,500", after: "3,000" },
      { field: "From", before: "—", after: "2026-09-25" },
    ]);
    expect(subjectOf("channel_price", "x", before, after, names)).toBe(
      "Espresso — Single, Dine-in",
    );
  });

  it("a change lists only what changed; bookkeeping columns are left out", () => {
    expect(
      describeChanges(
        { name: "Milk", is_active: true, created_at: "2026-01-01" },
        { name: "Fresh milk", is_active: false, created_at: "2026-09-25" },
        names,
      ),
    ).toEqual([
      { field: "Name", before: "Milk", after: "Fresh milk" },
      { field: "In use", before: "yes", after: "no" },
    ]);
  });

  it("a record added shows what it was given; one deleted, what it held", () => {
    const row = { id: "x", business_id: "b", name: "Cakes", sort_order: 5, name_ar: null };
    expect(describeChanges(null, row, names)).toEqual([
      { field: "Name", before: "", after: "Cakes" },
      { field: "Order on the till", before: "", after: "5" },
    ]);
    expect(describeChanges(row, null, names)).toEqual([
      { field: "Name", before: "Cakes", after: "" },
      { field: "Order on the till", before: "5", after: "" },
    ]);
  });

  it("ingredients read as a recipe, with their names", () => {
    expect(
      showValue(
        [
          { item: "Golden beans", qty: 100, unit: "g" },
          { item_id: I, qty: 1, unit_code: "each", channels: ["takeaway"] },
        ],
        "lines",
        names,
      ),
    ).toBe("Golden beans 100 g, Coffee beans 1 each (Takeaway)");
  });

  it("an id is given its name, or shown short when the name is not known", () => {
    expect(showValue(I, "item_id", names)).toBe("Coffee beans");
    expect(showValue("e0000000-0000-0000-0000-000000000009", "item_id", names)).toBe("e0000000…");
  });

  it("says what a row is about", () => {
    expect(subjectOf("item", I, null, { name: "Coffee beans" }, names)).toBe("Coffee beans");
    expect(subjectOf("item_unit", "u", null, { item_id: I, code: "case_24" }, names)).toBe(
      "Coffee beans: case_24",
    );
    expect(subjectOf("business", "b", null, null, names)).toBe("Business settings");
    expect(subjectOf("goods_receipt", "r", null, { receipt_no: 12 }, names)).toBe("Receipt 12");
    expect(subjectOf("inventory_movement", "m", null, { item: I }, names)).toBe("Coffee beans");
  });

  it("narrows to a kind of change, and nothing unknown", () => {
    expect(auditGroup("prices")?.prefixes).toEqual(["price."]);
    expect(auditGroup("nonsense")).toBeNull();
    expect(new Set(AUDIT_GROUPS.map((g) => g.key)).size).toBe(AUDIT_GROUPS.length);
  });
});

describe("a delivery at a price per unit (0027, the audit's P1-3)", () => {
  it("a line's total, and what it costs a base unit", () => {
    // 2 cases of 24 at 12,000 a case: 24,000, 500 a bottle.
    expect(deliveryLineCost(2, 24, 12000)).toEqual({ total: 24000, perBase: 500 });
    expect(deliveryLineCost(0, 24, 12000).perBase).toBeNull();
  });

  it("how far a price is from the cost now", () => {
    expect(priceGap(2.5, 50)).toBeCloseTo(-0.95);
    expect(priceGap(65, 25)).toBeCloseTo(1.6);
    expect(priceGap(10, null)).toBeNull();
    expect(priceGap(10, 0)).toBeNull();
  });

  it("knows the database asking for a price to be confirmed", () => {
    expect(needsPriceConfirmation("Check the price: Cups at 2.5 each is 95% below")).toBe(true);
    expect(needsPriceConfirmation("Choose an active supplier")).toBe(false);
  });
});

describe("reasons from a list (0028, the audit's P1-10)", () => {
  // The rows 0028 inserts into reason_code: kind, code, English label.
  const sql = readFileSync(join(__dirname, "../supabase/migrations/0028_exceptions.sql"), "utf8");
  const block = sql.slice(
    sql.indexOf("insert into reason_code"),
    sql.indexOf("on conflict (kind, code)"),
  );
  const rows = [...block.matchAll(/\('([a-z_]+)', '([a-z_]+)', '((?:[^']|'')+)', (\d+)\)/g)].map(
    ([, kind, code, label, order]) => ({
      kind: kind!,
      code: code!,
      label: label!,
      order: Number(order),
    }),
  );

  it("the screens offer exactly the database's reasons, in its order", () => {
    expect(rows.length).toBe(20);
    for (const kind of Object.keys(REASONS) as ReasonKind[]) {
      const db = rows.filter((r) => r.kind === kind).sort((a, b) => a.order - b.order);
      expect(
        db.map((r) => r.code),
        kind,
      ).toEqual([...REASONS[kind]]);
    }
  });

  it("each reads in English as the database keeps it, and in Arabic and Kurdish too", () => {
    const en = getDictionary("en");
    for (const r of rows) expect(en[reasonKey(r.kind as ReasonKind, r.code)], r.code).toBe(r.label);
    for (const locale of LOCALES) {
      const d = getDictionary(locale);
      for (const r of rows)
        expect(d[reasonKey(r.kind as ReasonKind, r.code)], `${locale} ${r.code}`).toBeTruthy();
    }
  });

  it('"Other" takes a few real words, as the database checks them', () => {
    expect(noteIsEnough("hjjjhjjk")).toBe(false); // one word
    expect(noteIsEnough("x y")).toBe(false); // two words, two letters
    expect(noteIsEnough("12 34 56 !!")).toBe(false); // no letters at all
    expect(noteIsEnough("cold coffee")).toBe(true);
    expect(noteIsEnough("قهوة باردة")).toBe(true);
    expect(reasonMissing(null, "")).toBe("choose");
    expect(reasonMissing("other", "no")).toBe("say");
    expect(reasonMissing("regular", "")).toBeNull();
  });
});

describe("a discount over the cap is approved by a manager (0028)", () => {
  const n = (v: number) => new Decimal(v);
  const cashier = { cap: 10, canApprove: false };
  const manager = { cap: 10, canApprove: true };
  const d = (
    kind: "percent" | "amount",
    value: string,
    extra: Partial<Discount> = {},
  ): Discount => ({
    kind,
    value,
    ...extra,
  });

  it("judges a percentage as asked, and an amount by the share of the bill it takes off", () => {
    expect(discountShare(d("percent", "12.5"), n(2500)).toString()).toBe("12.5");
    expect(discountShare(d("amount", "300"), n(2500)).toString()).toBe("12");
    expect(discountShare(d("amount", "1000"), n(6000)).toString()).toBe("16.67");
    expect(discountShare(d("amount", "9999"), n(2500)).toString()).toBe("100"); // never more than the bill
    expect(discountShare(d("amount", "500"), n(0)).toString()).toBe("0");
  });

  it("asks for a reason first, the words Other needs, then — over the cap — a manager", () => {
    expect(discountNeeds(d("percent", "10"), n(5000), cashier)).toBe("reason");
    expect(
      discountNeeds(d("percent", "10", { reason: "other", note: "x" }), n(5000), cashier),
    ).toBe("note");
    expect(discountNeeds(d("percent", "10", { reason: "regular" }), n(5000), cashier)).toBeNull();
    expect(discountNeeds(d("amount", "250", { reason: "regular" }), n(2500), cashier)).toBeNull();
    expect(discountNeeds(d("amount", "300", { reason: "regular" }), n(2500), cashier)).toBe(
      "approval",
    );
    expect(
      discountNeeds(d("percent", "50", { reason: "staff_meal" }), n(5000), manager),
    ).toBeNull();
  });

  it("an approval covers the share the manager was asked for, and no more", () => {
    const approved = { id: "a1", by: "Demo Manager", percent: 20 };
    const twenty = d("percent", "20", { reason: "complaint", approval: approved });
    expect(discountNeeds(twenty, n(5000), cashier)).toBeNull();
    expect(discountNeeds({ ...twenty, value: "25" }, n(5000), cashier)).toBe("approval");
    // An amount grows as a share when the bill shrinks.
    const amount = d("amount", "1000", { reason: "regular", approval: approved });
    expect(discountNeeds(amount, n(5000), cashier)).toBeNull(); // 20%
    expect(discountNeeds(amount, n(4000), cashier)).toBe("approval"); // 25%
    expect(approvalPercent(d("amount", "1000"), n(6000))).toBe(17); // 16.67, asked as 17
  });

  it("an approval the database would not take is dropped, and a manager asked again", () => {
    for (const e of [
      "That approval has been used: ask again",
      "That approval has run out: ask again",
      "That approval was given to someone else",
      "That approval is not for this",
      "The manager approved up to 20%: ask again for this one",
    ])
      expect(approvalRefused(e), e).toBe(true);
    expect(approvalRefused("A discount over 10% needs a manager's approval")).toBe(false);
    expect(approvalRefused("Choose a reason from the list")).toBe(false);
  });

  it("a discount already on the bill is not asked about again, nor sent again", () => {
    const kept = d("percent", "30", {
      kept: { reason: "Regular customer", by: "Demo Cashier", approvedBy: null },
    });
    expect(discountNeeds(kept, n(5000), cashier)).toBeNull();
    expect(discountWhy(kept)).toEqual({
      discountReason: null,
      discountNote: null,
      approvalId: null,
    });
    const fresh = d("percent", "30", {
      reason: "other",
      note: "  birthday cake  ",
      approval: { id: "a2", by: "Demo Manager", percent: 30 },
    });
    expect(discountWhy(fresh)).toEqual({
      discountReason: "other",
      discountNote: "birthday cake",
      approvalId: "a2",
    });
  });

  it("a saved bill's discount comes back with why, who gave it and who approved it", () => {
    const bill: OpenBill = {
      tabId: "t9",
      version: 2,
      tableId: null,
      tableName: null,
      label: "Window",
      channel: "dine_in",
      businessDay: "2026-09-25",
      openedAt: "2026-09-25T18:00:00Z",
      openedBy: "Demo Cashier",
      billPrintedAt: null,
      billPrintCount: 0,
      lines: [],
      subtotal: 0,
      discount: 0,
      discountPercent: 30,
      discountAmount: null,
      discountReason: "To make up for a complaint",
      discountBy: "Demo Cashier",
      discountApprovedBy: "Demo Manager",
      total: 0,
    };
    expect(orderFromBill(bill).discount?.kept).toEqual({
      reason: "To make up for a complaint",
      by: "Demo Cashier",
      approvedBy: "Demo Manager",
    });
  });
});

describe("the exceptions report, by person (0028)", () => {
  const row = (
    kind: ExceptionRow["kind"],
    person: string,
    amount: number | null,
    review: boolean,
  ): ExceptionRow => ({
    at: "2026-09-25T10:00:00Z",
    kind,
    personId: null,
    person,
    amount,
    reason: null,
    approvedBy: null,
    needsReview: review,
    reference: "Sale 1234abcd",
    detail: null,
  });

  it("counts each person's exceptions by kind, the money involved, and what waits for review", () => {
    const people = exceptionsByPerson([
      row("void", "Demo Manager", 2500, true),
      row("void", "Demo Manager", 2500, false),
      row("discount", "Demo Cashier", 500, false),
      row("wrong_pin", "Demo Cashier", null, true),
      row("refund", "Demo Manager", 3500, true),
    ]);
    expect(people.map((p) => [p.person, p.counts, p.amount, p.review])).toEqual([
      ["Demo Manager", { void: 2, refund: 1 }, 8500, 2],
      ["Demo Cashier", { discount: 1, wrong_pin: 1 }, 500, 1],
    ]);
  });
});
