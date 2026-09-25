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
import {
  RULE_LABEL,
  THRESHOLD_LABEL,
  THRESHOLD_ORDER,
  briefCalculations,
  briefFacts,
  briefToDo,
  canAnswer,
  groupByRule,
  overall,
  parseBrief,
  parseThresholds,
  snoozeRange,
  sortAlerts,
  thresholdChanges,
  type Alert,
} from "@/lib/alerts";
import { exceptionsByPerson, type ExceptionRow } from "@/lib/exceptions";
import {
  cancellableCard,
  cardMath,
  matchIssues,
  owedByPlatform,
  parseCardTakings,
  parseMatch,
  parseStatement,
  statementAmount,
  tillThrough,
} from "@/lib/settlements";
import { cleanOrderNo, platformOrderNo } from "@/lib/validation";
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
import {
  channelName,
  channelSet,
  isPlatformChannel,
  parseChannels,
  type Channel,
} from "@/lib/channels";
import {
  batchCost,
  batchesOf,
  perUnit,
  showIn,
  unitFactor,
} from "@/components/production/batchMath";
import { filledLines, halfFilled, linesFrom, newLine } from "@/components/menu/RecipeLines";

const perms = (role: Role) => [...ROLE_PERMISSIONS[role]];

/** The café's channels as the live one has them, with a platform it added itself (0031). */
const CHANNELS: Channel[] = [
  { code: "dine_in", name: "Dine-in", names: {}, kind: "dine_in", active: true },
  { code: "takeaway", name: "Takeaway", names: {}, kind: "takeaway", active: true },
  { code: "direct_delivery", name: "Direct delivery", names: {}, kind: "delivery", active: true },
  { code: "talabat", name: "Talabat", names: { ar: "طلبات" }, kind: "platform", active: true },
  { code: "careem", name: "Careem", names: {}, kind: "platform", active: false },
  {
    code: "lezzoo",
    name: "Lezzoo",
    names: { ar: "ليزو", ckb: "لێزۆ" },
    kind: "platform",
    active: true,
  },
];
const SET = channelSet(CHANNELS);

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
      line("cup", "1", "each", channelsFor("to_go", [], SET)),
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
    expect(channelsFor("all", [], SET)).toEqual([]);
    // Every channel in use but a table: a platform the café added too, not one out of use.
    expect(channelsFor("to_go", [], SET)).toEqual([
      "takeaway",
      "direct_delivery",
      "talabat",
      "lezzoo",
    ]);
    expect(channelsFor("dine_in", [], SET)).toEqual(["dine_in"]);
    expect(channelsFor("custom", ["talabat"], SET)).toEqual(["talabat"]);
    // Every channel in use ticked, or none, is every order.
    expect(channelsFor("custom", [...SET.inUse], SET)).toEqual([]);
    expect(channelsFor("custom", [], SET)).toEqual([]);
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
    const lines = linesFrom(
      [
        { itemId: "beans", quantity: 18, unitCode: "g", channels: null },
        {
          itemId: "cup",
          quantity: 1,
          unitCode: "each",
          channels: ["takeaway", "direct_delivery", "lezzoo", "talabat"],
        },
        { itemId: "saucer", quantity: 1, unitCode: "each", channels: ["dine_in"] },
        { itemId: "lid", quantity: 1, unitCode: "each", channels: ["takeaway", "talabat"] },
        { itemId: "milk", quantity: 1000, unitCode: "ml" },
        { itemId: "bag", quantity: 1, unitCode: "each", channels: ["talabat", "careem"] },
      ],
      SET,
    );
    expect(lines.map((l) => l.use)).toEqual(["all", "to_go", "dine_in", "custom", "all", "custom"]);
    expect(lines[3]!.ticked).toEqual(["takeaway", "talabat"]);
    expect(lines[4]!.quantity).toBe("1000"); // no thousands separator in a box to edit
    expect(new Set(lines.map((l) => l.key)).size).toBe(6);
    // A platform out of use stays ticked: the line is saved as it was.
    expect(lines[5]!.ticked).toEqual(["talabat", "careem"]);
    expect(filledLines(lines, SET)[5]!.channels).toEqual(["talabat", "careem"]);
  });

  it("stops at a half-filled line and sends only whole ones", () => {
    const blank = newLine();
    const half = { ...newLine(), itemId: "beans", unit: "g" };
    const whole = { ...newLine(), itemId: "cup", quantity: "1", unit: "each" };
    expect(halfFilled([whole, blank])).toBe(-1);
    expect(halfFilled([whole, half])).toBe(1);
    expect(filledLines([whole, blank], SET)).toEqual([
      { itemId: "cup", qty: "1", unitCode: "each", channels: [] },
    ]);
  });
});

describe("the café's channels (0031)", () => {
  it("tells a delivery platform from the shop's own three by its code", () => {
    expect(["dine_in", "takeaway", "direct_delivery"].map(isPlatformChannel)).toEqual([
      false,
      false,
      false,
    ]);
    expect(["talabat", "lezzoo", "platform_1"].every(isPlatformChannel)).toBe(true);
  });

  it("sells through the channels in use: a platform out of use is kept, not offered", () => {
    expect(SET.all).toEqual(CHANNELS.map((c) => c.code));
    expect(SET.inUse).toEqual(["dine_in", "takeaway", "direct_delivery", "talabat", "lezzoo"]);
  });

  it("names each in the reader's language: a platform as the café named it there", () => {
    expect(channelName(CHANNELS, "dine_in", "ar")).toBe("تناول في المكان");
    expect(channelName(CHANNELS, "takeaway", "ckb")).toBe("بردن");
    expect(channelName(CHANNELS, "talabat", "ar")).toBe("طلبات");
    expect(channelName(CHANNELS, "talabat", "ckb")).toBe("Talabat"); // no Kurdish name given
    expect(channelName(CHANNELS, "lezzoo", "ckb")).toBe("لێزۆ");
    expect(channelName(CHANNELS, "lezzoo", "en")).toBe("Lezzoo");
    expect(channelName(CHANNELS, "careem", "ar")).toBe("Careem");
    // One the list does not have (an old sale's): its code, readable.
    expect(channelName(CHANNELS, "old_platform", "en")).toBe("Old platform");
  });

  it("reads the database's list, and nothing it does not understand as in use", () => {
    expect(
      parseChannels([
        { code: "dine_in", name: "Dine-in", names: {}, kind: "dine_in", is_active: true },
        {
          code: "lezzoo",
          name: "Lezzoo",
          names: { ar: "ليزو", ckb: " " },
          kind: "platform",
          is_active: false,
        },
      ]),
    ).toEqual([
      { code: "dine_in", name: "Dine-in", names: {}, kind: "dine_in", active: true },
      { code: "lezzoo", name: "Lezzoo", names: { ar: "ليزو" }, kind: "platform", active: false },
    ]);
    expect(parseChannels(null)).toEqual([]);
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

describe("the system speaks: alerts and the daily brief (0029, the audit's P1-8)", () => {
  const migration = readFileSync(join(__dirname, "../supabase/migrations/0029_alerts.sql"), "utf8");
  // The rules as the latest migration to redefine them has them (0030).
  const rules = readFileSync(
    join(__dirname, "../supabase/migrations/0030_card_and_platform_money.sql"),
    "utf8",
  );
  const alert = (over: Partial<Alert>): Alert => ({
    id: "a",
    rule: "margin",
    subject: "s",
    urgency: "orange",
    title: "t",
    why: null,
    action: null,
    confidence: "high",
    link: null,
    firstSeenAt: "2026-09-25T08:00:00Z",
    lastSeenAt: "2026-09-25T09:00:00Z",
    acknowledgedAt: null,
    acknowledgedBy: null,
    ackNote: null,
    snoozedUntil: null,
    snoozedBy: null,
    snoozeReason: null,
    ...over,
  });

  it("red first, then orange, oldest first; answered and snoozed apart", () => {
    const list = [
      alert({ id: "o2", firstSeenAt: "2026-09-25T09:00:00Z" }),
      alert({ id: "r", urgency: "red", firstSeenAt: "2026-09-25T10:00:00Z" }),
      alert({ id: "o1", firstSeenAt: "2026-09-25T07:00:00Z" }),
      alert({ id: "ack", urgency: "red", acknowledgedAt: "2026-09-25T10:30:00Z" }),
      alert({ id: "zz", snoozedUntil: "2026-09-27T21:00:00Z" }),
    ];
    const { needsYou, answered } = sortAlerts(list);
    expect(needsYou.map((a) => a.id)).toEqual(["r", "o1", "o2"]);
    expect(answered.map((a) => a.id)).toEqual(["ack", "zz"]);
    expect(overall(list)).toBe("red");
    expect(overall(list.filter((a) => a.id !== "r"))).toBe("orange");
    expect(overall([list[3]!, list[4]!])).toBe("green");
  });

  it("orange alerts of one rule fold together, in the order the rules first appear", () => {
    const g = groupByRule([
      alert({ id: "1", rule: "no_cost" }),
      alert({ id: "2", rule: "bill_due" }),
      alert({ id: "3", rule: "no_cost" }),
    ]);
    expect(g.map((x) => [x.rule, x.alerts.map((a) => a.id)])).toEqual([
      ["no_cost", ["1", "3"]],
      ["bill_due", ["2"]],
    ]);
  });

  it("nobody answers an alert about their own exceptions", () => {
    expect(canAnswer(alert({ rule: "exceptions_person", subject: "me" }), "me")).toBe(false);
    expect(canAnswer(alert({ rule: "exceptions_person", subject: "them" }), "me")).toBe(true);
    expect(canAnswer(alert({ rule: "margin", subject: "me" }), "me")).toBe(true);
  });

  it("a snooze runs from tomorrow to 30 days ahead, a week offered", () => {
    expect(snoozeRange("2026-09-25")).toEqual({
      min: "2026-09-26",
      max: "2026-10-25",
      suggested: "2026-10-02",
    });
  });

  it("every rule the database checks has a name on the screen", () => {
    const emitted = new Set([
      ...[...rules.matchAll(/select '([a-z_]+)'::text, /g)].map((m) => m[1]),
      ...[...rules.matchAll(/rule := '([a-z_]+)'/g)].map((m) => m[1]),
    ]);
    // Subjects written the same way, not rules.
    for (const subject of ["waste", "1010", "unmatched"]) emitted.delete(subject);
    expect([...emitted].sort()).toEqual(Object.keys(RULE_LABEL).sort());
  });

  it("the thresholds are the database's, with the same words", () => {
    const json = migration.match(/select '(\{[\s\S]*?\})'::jsonb/)?.[1] ?? "{}";
    const rules = JSON.parse(json.replace(/''/g, "'")) as Record<string, { label: string }>;
    expect(Object.keys(rules).sort()).toEqual([...THRESHOLD_ORDER].sort());
    for (const [k, r] of Object.entries(rules)) expect(THRESHOLD_LABEL[k], k).toBe(r.label);
  });

  it("thresholds are checked as the database checks them; empty is the default again", () => {
    const list = parseThresholds({
      count_stale_hours: { default: 8, min: 1, max: 72, whole: true, label: "Hours", value: 12 },
      margin_target_percent: {
        default: 70,
        min: 0,
        max: 95,
        whole: false,
        label: "Margin",
        value: 70,
      },
    });
    expect(list.map((t) => t.key)).toEqual(["margin_target_percent", "count_stale_hours"]);
    expect(thresholdChanges(list, { count_stale_hours: "", margin_target_percent: "" })).toEqual({
      ok: true,
      changes: { count_stale_hours: null },
    });
    expect(
      thresholdChanges(list, { count_stale_hours: "12", margin_target_percent: "65.5" }),
    ).toEqual({
      ok: true,
      changes: { margin_target_percent: 65.5 },
    });
    expect(thresholdChanges(list, { count_stale_hours: "2.5" })).toEqual({
      ok: false,
      error: "Hours: enter a whole number from 1 to 72",
    });
    expect(thresholdChanges(list, { margin_target_percent: "96" })).toEqual({
      ok: false,
      error: "Margin: enter a number from 0 to 95",
    });
    expect(thresholdChanges(list, { margin_target_percent: "lots" })).toEqual({
      ok: false,
      error: "Margin: enter a number",
    });
  });

  // The day the SQL test builds: three sales, one voided, one refunded, one
  // discounted; beans wasted; the drawer 500 short.
  const brief = parseBrief({
    day: "2026-09-24",
    facts: {
      sales: 2,
      net_sales: 5000,
      voids: 1,
      voided: 2500,
      refunds: 1,
      refunded: 900,
      discounts: 1,
      discounted: 100,
      waste: 1000,
      drawer_counts: 1,
      drawer_difference: -500,
      uncosted_sales: 0,
    },
    calculations: {
      cost_of_goods: 400,
      cost_of_goods_percent: 8.0,
      gross_profit: 3600,
      gross_margin_percent: 72.0,
      same_day_last_week: 4000,
      change_from_last_week_percent: 25.0,
      usual_for_the_weekday: 4500,
    },
    alerts: [
      {
        urgency: "red",
        title: "Bank is -50,000 IQD: below zero",
        action: "Open it.",
        link: null,
        acknowledged: false,
      },
      { urgency: "orange", title: "Cups", action: "Order it.", link: null, acknowledged: false },
      { urgency: "orange", title: "Milk", action: "Order it.", link: null, acknowledged: true },
    ],
    red: 1,
    orange: 2,
    recommendations: ["Open it."],
  });

  it("the brief's facts say what happened, and nothing else", () => {
    expect(briefFacts(brief)).toEqual([
      "Net sales 5,000 IQD over 2 sales.",
      "1 void (2,500 IQD).",
      "1 refund (900 IQD).",
      "1 discount (100 IQD).",
      "Waste 1,000 IQD.",
      "The drawer was counted 500 IQD short.",
    ]);
  });

  it("its calculations, apart", () => {
    expect(briefCalculations(brief, "Thursday")).toEqual([
      "Cost of goods 400 IQD, 8% of sales.",
      "Gross profit 3,600 IQD (72%), after waste and every other cost of sales.",
      "Last Thursday: 4,000 IQD (+25% since).",
      "A usual Thursday (the four before): 4,500 IQD.",
    ]);
  });

  it("and what to do: the red alerts nobody has answered, else what can wait", () => {
    expect(briefToDo(brief)).toEqual(["Open it."]);
    expect(briefToDo({ ...brief, recommendations: [] })).toEqual([
      "Nothing urgent. 1 orange alert waits for a quiet moment.",
    ]);
    expect(briefToDo({ ...brief, recommendations: [], alerts: [] })).toEqual(["Nothing to do."]);
  });

  it("a day with no sales says so", () => {
    const quiet = parseBrief({ day: "2026-09-23", facts: {}, calculations: {}, alerts: [] });
    expect(briefFacts(quiet)).toEqual(["No sales."]);
    expect(briefCalculations(quiet, "Wednesday")).toEqual([
      "Nothing to calculate: there were no sales.",
    ]);
  });

  it("an answer or a new threshold reads plainly on the audit trail", () => {
    expect(actionLabel("alert.acknowledge")).toBe("Alert answered");
    expect(actionLabel("alert.snooze")).toBe("Alert snoozed");
    expect(auditGroup("alerts")?.prefixes).toEqual(["alert."]);
    const none = new Map<string, string>();
    expect(
      describeChanges(
        { alert_settings: {} },
        { alert_settings: { margin_target_percent: 65 } },
        none,
      ),
    ).toEqual([
      { field: "Alert thresholds", before: "the defaults", after: "Margin target (%) 65" },
    ]);
    expect(subjectOf("alert", "x", null, { rule: "cash_negative", title: "Bank" }, none)).toBe(
      "Cash below zero",
    );
    expect(showValue("running_out", "rule", none)).toBe("Running out");
  });

  it("the dashboard's words are there in English, Arabic and Kurdish", () => {
    for (const locale of LOCALES) {
      const d = getDictionary(locale);
      for (const k of [
        "needsYou",
        "allClear",
        "answered",
        "yesterday",
        "today",
        "facts",
        "calculations",
        "toDo",
      ])
        expect(d[`dash.${k}`], `${locale} dash.${k}`).toBeTruthy();
    }
  });
});

describe("card and platform money, reconciled (0030, the audit's P1-9)", () => {
  const migration = readFileSync(
    join(__dirname, "../supabase/migrations/0030_card_and_platform_money.sql"),
    "utf8",
  );

  it("an order number as the tablet shows it, in any script; the database's rule, kept", () => {
    expect(cleanOrderNo(" #١٢٣ ٤٥ ")).toBe("12345");
    expect(cleanOrderNo("TB-99/7")).toBe("TB-99/7");
    expect(platformOrderNo.parse("  ")).toBeNull();
    expect(platformOrderNo.parse("#5501")).toBe("5501");
    expect(platformOrderNo.safeParse("55:01").success).toBe(false);
    expect(platformOrderNo.safeParse("x".repeat(41)).success).toBe(false);
    // The same characters the database accepts, and the same length.
    expect(migration).toContain("v_no !~ '^[A-Za-z0-9#/_.-]+$'");
    expect(migration).toContain("length(v_no) > 40");
  });

  const takings = parseCardTakings({
    from: "2026-09-20",
    days: [
      { day: "2026-09-20", amount: 4000 },
      { day: "2026-09-21", amount: "2500" },
      { day: "2026-09-22", amount: 1000 },
    ],
    balance: 7500,
    settlements: [
      { id: "a", covers_from: "2026-09-10", covers_to: "2026-09-14", till_total: 1, received: 1 },
      { id: "b", covers_from: "2026-09-15", covers_to: "2026-09-19", till_total: 1, received: 1 },
      {
        id: "c",
        covers_from: "2026-09-15",
        covers_to: "2026-09-19",
        cancelled_at: "2026-09-20T10:00:00Z",
      },
    ],
  });

  it("the card takings up to a day, and the settlement that can be cancelled", () => {
    expect(takings.days.map((d) => d.amount)).toEqual([4000, 2500, 1000]);
    expect(tillThrough(takings.days, "2026-09-21").toNumber()).toBe(6500);
    expect(tillThrough(takings.days, "2026-09-22").toNumber()).toBe(7500);
    expect(cancellableCard(takings.settlements)).toBe("b");
    expect(cancellableCard([])).toBeNull();
  });

  it("a settlement's fee and difference, worked out as the database does", () => {
    // 6,500 at the till; the terminal says 6,500; 6,370 reached the bank.
    const same = cardMath(6500, "6,500", "٦٣٧٠");
    expect([same.fee?.toNumber(), same.difference?.toNumber(), same.problem]).toEqual([
      130,
      0,
      null,
    ]);
    // A card sale the terminal never took: the till is 500 over the terminal.
    const over = cardMath(6500, "6000", "5880");
    expect([over.fee?.toNumber(), over.difference?.toNumber()]).toEqual([120, 500]);
    expect(cardMath(6500, "6000", "6100").problem).toBe("more_than_terminal");
    expect(cardMath(6500, "", "100").problem).toBe("terminal");
    expect(cardMath(6500, "100", "x").problem).toBe("received");
    // record_card_settlement: fee = terminal − received; difference = till − terminal.
    expect(migration).toContain("v_fee := v_terminal - v_received;");
    expect(migration).toContain("v_diff := v_till - v_terminal;");
  });

  it("amounts as statements print them", () => {
    expect(statementAmount("1,500")).toBe("1500");
    expect(statementAmount("IQD 2,550.50")).toBe("2550.5");
    expect(statementAmount("(900)")).toBe("-900");
    expect(statementAmount("-900")).toBe("-900");
    expect(statementAmount("٤٥٠ د.ع")).toBe("450");
    expect(statementAmount("n/a")).toBeNull();
    expect(statementAmount("")).toBeNull();
  });

  it("a statement pasted from a spreadsheet, read by its column names", () => {
    const p = parseStatement(
      [
        "Order Date\tOrder ID\tOrder Value\tCommission (IQD)\tNet Payout",
        "2026-09-20\t#5501\t3,000\t-450\t2,550",
        "",
        "2026-09-20\t5503\t3,000\t(450)\t2,400",
        "Total\t\t6,000\t-900\t4,950",
      ].join("\n"),
    );
    expect(p.problems).toEqual([]);
    expect(p.columns).toEqual({
      orderNo: "Order ID",
      payout: "Net Payout",
      commission: "Commission (IQD)",
      fees: null,
    });
    expect(p.lines).toEqual([
      { orderNo: "5501", payout: "2550", commission: "450", fees: null },
      { orderNo: "5503", payout: "2400", commission: "450", fees: null },
    ]);
  });

  it("a total row is left out, wherever the order column is", () => {
    const p = parseStatement("Order,Payout\n5501,2550\nTotal,2550");
    expect([p.lines.length, p.skipped]).toEqual([1, 1]);
  });

  it("without column names, the columns are order, payout, commission and fees", () => {
    const p = parseStatement('5501,"2,550",450\n5503,2400,450,100\n9999,1000');
    expect(p.problems).toEqual([]);
    expect(p.columns).toBeNull();
    expect(p.lines).toEqual([
      { orderNo: "5501", payout: "2550", commission: "450", fees: null },
      { orderNo: "5503", payout: "2400", commission: "450", fees: "100" },
      { orderNo: "9999", payout: "1000", commission: null, fees: null },
    ]);
  });

  it("what cannot be read is said, by the line it is on", () => {
    expect(parseStatement("Date,Amount\n2026-09-20,3000").problems[0]).toMatch(
      /^Line 1: the columns were not recognised/,
    );
    const p = parseStatement("Order;Payout\n5501;abc\n;2000\n5502;\n55 02:x;100");
    expect(p.problems).toEqual([
      'Line 2 (order 5501): the payout "abc" is not an amount.',
      "Line 3 has a payout but no order number.",
      "Line 4 (order 5502) has no payout.",
      'Line 5: "55 02:x" is not an order number.',
    ]);
    expect(p.lines).toEqual([]);
  });

  const match = parseMatch({
    platform: "talabat",
    matched: 2,
    lines: [
      {
        line: 1,
        order_no: "5501",
        status: "matched",
        payout: 2550,
        commission: 450,
        fees: 0,
        expected: 3000,
        difference: 0,
      },
      {
        line: 2,
        order_no: "5503",
        status: "matched",
        payout: 2400,
        commission: 450,
        fees: 100,
        expected: 3000,
        difference: 50,
      },
      { line: 3, order_no: "5504", status: "voided", payout: 2550, commission: 450 },
      { line: 4, order_no: "9999", status: "not_found", payout: 1000 },
      { line: 5, order_no: "5501", status: "duplicate", payout: 2550 },
    ],
    missing: [{ order_no: "5502", sale_id: "s", placed_at: "2026-09-20T10:00:00Z", amount: 3000 }],
    totals: {
      orders: 6000,
      payout: 4950,
      commission: 900,
      fees: 100,
      difference: 50,
      not_posted: 6100,
    },
    journal: [
      { code: "1020", debit: 4950 },
      { code: "5100", debit: 900 },
      { code: "5200", debit: 150 },
      { code: "1100", credit: 6000 },
    ],
  });

  it("the database's match: each line, the orders left out, the journal it proposes", () => {
    expect(match.lines.map((l) => l.status)).toEqual([
      "matched",
      "matched",
      "voided",
      "not_found",
      "duplicate",
    ]);
    expect(matchIssues(match)).toBe(4);
    expect(match.missing.map((m) => m.orderNo)).toEqual(["5502"]);
    expect(match.totals.notPosted).toBe(6100);
    const dr = match.journal.reduce((s, j) => s + j.debit, 0);
    const cr = match.journal.reduce((s, j) => s + j.credit, 0);
    expect([dr, cr]).toEqual([6000, 6000]);
  });

  it("what each platform owes, and since when", () => {
    expect(
      owedByPlatform([
        {
          platform: "talabat",
          orderNo: "1",
          saleId: "a",
          placedAt: "2026-09-20T10:00:00Z",
          amount: 3000,
          days: 5,
        },
        {
          platform: "careem",
          orderNo: "2",
          saleId: "b",
          placedAt: "2026-09-22T10:00:00Z",
          amount: 2000,
          days: 3,
        },
        {
          platform: "talabat",
          orderNo: "3",
          saleId: "c",
          placedAt: "2026-09-18T10:00:00Z",
          amount: 1500,
          days: 7,
        },
      ]),
    ).toEqual([
      { platform: "careem", count: 1, amount: 2000, oldest: "2026-09-22T10:00:00Z", overDays: 3 },
      { platform: "talabat", count: 2, amount: 4500, oldest: "2026-09-18T10:00:00Z", overDays: 7 },
    ]);
  });

  it("the settlements have names on the audit trail", () => {
    for (const a of [
      "card.settlement",
      "card.settlement_cancel",
      "platform.settlement",
      "platform.settlement_cancel",
    ]) {
      expect(migration).toContain(`'${a}'`);
      expect(actionLabel(a)).not.toBe(a);
    }
    expect(AUDIT_GROUPS.find((g) => g.key === "settlements")?.prefixes).toEqual([
      "card.",
      "platform.settlement",
      "platform.settlement_cancel",
    ]);
    const none = new Map<string, string>();
    expect(
      subjectOf("card_settlement", "x", null, { from: "2026-09-20", to: "2026-09-22" }, none),
    ).toBe("Card takings 2026-09-20 to 2026-09-22");
    expect(
      subjectOf(
        "platform_settlement",
        "x",
        null,
        { platform: "Talabat", reference: "TLB-0925" },
        none,
      ),
    ).toBe("Talabat statement TLB-0925");
  });

  it("the till's words for the order number are there in English, Arabic and Kurdish", () => {
    for (const locale of LOCALES) {
      const d = getDictionary(locale);
      for (const k of ["pos.orderNo", "pos.orderNoHint", "pos.orderNoFormat", "print.orderNo"])
        expect(d[k], `${locale} ${k}`).toBeTruthy();
      expect(d["pos.orderNo"], locale).toContain("{platform}");
      expect(d["print.orderNo"], locale).toContain("{no}");
    }
  });
});

describe("delivery platforms the café adds itself (0031)", () => {
  const migration = readFileSync(
    join(__dirname, "../supabase/migrations/0031_delivery_platforms.sql"),
    "utf8",
  );

  it("each change to a platform is on the audit trail, in words, with the settings", () => {
    for (const a of ["platform.create", "platform.setup", "platform.update"]) {
      expect(migration).toContain(`'${a}'`);
      expect(actionLabel(a)).not.toBe(a);
      expect(AUDIT_GROUPS.find((g) => g.key === "settings")?.prefixes).toContain(a);
      expect(AUDIT_GROUPS.find((g) => g.key === "settlements")?.prefixes).not.toContain(a);
    }
    expect(
      describeChanges(
        { platform_code: "lezzoo", name: "Lezzoo", names: {}, is_active: true },
        {
          platform_code: "lezzoo",
          name: "Lezzoo Express",
          names: { ar: "ليزو" },
          is_active: false,
        },
        new Map(),
      ),
    ).toEqual([
      { field: "Name", before: "Lezzoo", after: "Lezzoo Express" },
      { field: "In other languages", before: "—", after: "ar ليزو" },
      { field: "In use", before: "yes", after: "no" },
    ]);
    // A price on it names the platform as the café does; one the trail cannot name, readably.
    const names = new Map([["channel:lezzoo", "Lezzoo Express"]]);
    expect(showValue("lezzoo", "channel", names)).toBe("Lezzoo Express");
    expect(showValue("dine_in", "channel", new Map())).toBe("Dine-in");
    expect(showValue("baly_food", "channel", new Map())).toBe("Baly food");
  });

  it("the platforms screen speaks English, Arabic and Kurdish", () => {
    const keys = Object.keys(getDictionary("en")).filter((k) => k.startsWith("plat."));
    expect(keys.length).toBeGreaterThan(30);
    const placeholders: [string, string][] = [
      ["plat.retire.confirm", "{name}"],
      ["plat.retired", "{name}"],
      ["plat.restored", "{name}"],
      ["plat.added", "{name}"],
      ["plat.copied", "{prices}"],
      ["plat.copied", "{lines}"],
      ["plat.setupFailed", "{error}"],
      ["plat.form.nameIn", "{language}"],
    ];
    for (const locale of LOCALES) {
      const d = getDictionary(locale);
      for (const k of keys) expect(d[k], `${locale} ${k}`).toBeTruthy();
      for (const [k, p] of placeholders) expect(d[k], `${locale} ${k}`).toContain(p);
    }
  });

  it("names a platform from the database, not the dictionary", () => {
    for (const locale of LOCALES) {
      const d = getDictionary(locale);
      for (const c of ["talabat", "careem", "toters"])
        expect(d[`pos.channel.${c}`], `${locale} ${c}`).toBeUndefined();
    }
    // The three 0030 set up are named in Arabic and Kurdish by the migration.
    expect(migration).toContain(`'{"ar": "طلبات", "ckb": "تەلەبات"}'`);
  });
});
