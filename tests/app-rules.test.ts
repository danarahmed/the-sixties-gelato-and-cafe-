/**
 * The small rules the screens depend on: who lands where, what the menu
 * offers each role, how numbers typed in three scripts are read, what a
 * discount at the till comes to, what a new recipe costs and what price that
 * suggests, what a batch uses and costs, when a trading day starts, what the
 * drawer count shows before it is posted, and when a failed call is a refusal
 * and when it is an unknown.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ROLE_PERMISSIONS, type Role } from "@domain/auth/permissions.js";
import { NAV, holdsAny, homeFor, isPublicPath } from "@/lib/auth/routes";
import {
  addDays,
  dateIn,
  dayStart,
  isoToLocalTime,
  localTimeToIso,
  monthEnd,
  monthStart,
  parseDay,
} from "@/lib/dates";
import {
  PRODUCTION_PHRASES,
  keepsFields,
  keepsHours,
  keepsLabel,
  lotMovementLabel,
  lotsFrom,
  planFrom,
  productionReportFrom,
  reconciliationFrom,
  storyAddsUp,
  storyFrom,
} from "@/lib/production";
import {
  GIVEAWAY_KINDS,
  LOSS_ACCOUNT_NAME,
  LOSS_KINDS,
  LOSS_PHRASES,
  NEEDS_APPROVAL,
  NEEDS_STOCK_APPROVAL,
  giveawayLabel,
  kindShare,
  lossKind,
  lossReportFrom,
  lossesWaitingFrom,
} from "@/lib/losses";
import { movementLabel, unitName } from "@/lib/format";
import { normaliseNumber, positive, signedNonZero } from "@/lib/validation";
import { getBookkeeper } from "@/lib/bookkeeping/rules";
import { isUncertainFailure, rpcLogLine } from "@/lib/db/rpcOutcome";
import {
  cashNote,
  closeSplit,
  countResult,
  drawerStateFrom,
  notesCounted,
  notesTotal,
  type CashOnHand,
} from "@/lib/cash";
import {
  postedPayments,
  SAME_PAYMENT,
  SAME_PAYMENT_DAYS,
  sameFromServer,
  samePayments,
} from "@/lib/expenses";
import {
  addMonths,
  isPrepaidShare,
  recordedAmount,
  prepaidFrom,
  prepaidRefusal,
  prepaidShares,
  stillAhead,
  PREPAID_MONTHS,
} from "@/lib/prepaid";
import {
  allThatIsLeft,
  refundLineAmount,
  refundPlan,
  roundMoney,
  shareOf,
  type RefundableLine,
} from "@/lib/refunds";
import { salesTotals } from "@/lib/db/salesTotals";
import {
  changeGiven,
  checkRefundSplit,
  checkSplit,
  howPaid,
  leftToGiveBack,
  proportionalParts,
  refundSplitMessage,
  saleReceipt,
} from "@/lib/payments";
import {
  AUDIT_GROUPS,
  actionLabel,
  auditGroup,
  describeChanges,
  showValue,
  subjectIn,
  subjectOf,
  valueIn,
} from "@/lib/audit";
import { nextFreeCode } from "@/lib/chart";
import {
  isScreenWord,
  SCREEN_WORD_NAME,
  SCREEN_WORD_RENAME,
  screenWordRefusal,
} from "@/lib/i18n/screenWords";
import { bankMath, linesTo } from "@/lib/bank";
import { deliveryLineCost, needsPriceConfirmation, packCode, priceGap } from "@/lib/receiving";
import { lookAlike, lookAlikes, nameKey, slips } from "@/lib/names";
import { REASONS, noteIsEnough, reasonKey, reasonMissing, type ReasonKind } from "@/lib/reasons";
import { LOCALES, builtInWords, getDictionary } from "@/lib/i18n/dictionaries";
import {
  CHOICE_LABEL,
  RULE_HELP as SETTINGS_RULE_HELP,
  RULE_LABEL as SETTINGS_RULE_LABEL,
  RULE_ORDER,
  SCOPE_LABEL,
  parseBusinessRules,
  typedRuleValue,
  type ScopeType,
} from "@/lib/rules";
import { messenger, translator } from "@/lib/i18n/core";
import {
  RULE_LABEL,
  THRESHOLD_LABEL,
  THRESHOLD_ORDER,
  briefCalculations,
  briefFacts,
  briefToDo,
  canAnswer,
  groupByRule,
  splitRed,
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
  checkDollars,
  dollarsFor,
  dollarsReportFrom,
  fmtUSD,
  fxStatusFrom,
  RATE_REFUSED,
  suggestedDollars,
  usdValue,
} from "@/lib/fx";
import { howPaid as howPaidUsd, paidPart as paidPartUsd } from "@/lib/payments";
import { payments as paymentsSchema } from "@/lib/validation";
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
import {
  CREDIT_KIND_LABEL,
  PURCHASING_PHRASES,
  STAGE_LABEL,
  differences,
  inOrderUnit,
  isOpen,
  needsDeliveryConfirmation,
  orderStage,
  orderTotal,
  prefillFromOrder,
  purchaseOrderFrom,
  purchaseOrdersFrom,
  purchasingReportFrom,
  statementFrom,
  type PoLine,
} from "@/lib/purchasing";
import {
  BUYING_PHRASES,
  STATUS_LABEL,
  buyingListFrom,
  bySupplier,
  draftOf,
  inPack,
  listStamp,
  needOf,
  packsFor,
  packsIn,
  reasonsOf,
  sourceOf,
  withSupplier,
} from "@/lib/buying";
import Decimal from "decimal.js";
import {
  addLine,
  addonMenu,
  addonNames,
  addonsMissing,
  linePrice,
  ticketChanges,
  ticketLines,
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
  NO_ADDONS_MENU,
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
  showNice,
  unitFactor,
} from "@/components/production/batchMath";
import { filledLines, halfFilled, linesFrom, newLine } from "@/components/menu/RecipeLines";
import {
  STAFF_PHRASES,
  advancesFrom,
  clockAnswerFrom,
  clockTime,
  monthText,
  payrollDetailFrom,
  payrollTotals,
  splitMinutes,
  staffFrom,
  staffReportFrom,
  typedHours,
  typedTime,
  weekDays,
  weekStart,
  worksOn,
} from "@/lib/staff";
import { fieldLabel } from "@/lib/audit";
import { pnlByPlace, type PnlPlaceRow } from "@/lib/pnl";
import {
  CUSTOMER_PHRASES,
  addressText,
  customerReportFrom,
  phoneText,
  rewardOff,
  saleCustomerFrom,
  tillCustomerFrom,
} from "@/lib/customers";
import {
  ANALYSIS_PHRASES,
  analysisGrain,
  analysisProblem,
  barWidth,
  isSalesDimension,
  purchasesFrom,
  rowName,
  salesAnalysisFrom,
  stockValueFrom,
} from "@/lib/analysis";
import {
  balanceRows,
  balanceSheetFrom,
  CASH_FLOW_LINES,
  CASH_FLOW_SECTIONS,
  cashFlowFrom,
  cashFlowLabel,
  STATEMENT_PHRASES,
} from "@/lib/statements";
import {
  DOCUMENT_KINDS,
  DOCUMENT_PERMISSIONS,
  DOCUMENT_PHRASES,
  documentCountsFrom,
  documentName,
  documentPath,
  documentRecordFrom,
  fileProblem,
  shouldShrink,
  shrunkSize,
  sizeLabel,
} from "@/lib/documents";
import {
  likeText,
  namesMatch,
  phoneTail,
  readJournalQuery,
  readSaleQuery,
  searchText,
} from "@/lib/find";

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
        addons: [],
      },
    ];
    const bill = { ...quickOrder("takeaway"), kind: "bill" as const, lines };
    bill.saved = signature(lines, null);
    expect(orderSubtotal(bill, byId, to500, NO_ADDONS_MENU).toString()).toBe("5000");
    expect(isDirty(bill)).toBe(false);

    const discounted = { ...bill, discount: pct("10") };
    expect(orderDue(discounted, byId, to500, NO_ADDONS_MENU).toString()).toBe("4500");
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
        modifiers: [],
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
    expect(orderDue(o, byId, money, NO_ADDONS_MENU).toFixed()).toBe("5000");
  });

  it("one more of the same is at the printed price too, as the database adds it", () => {
    const o = orderFromBill(printed);
    // The printed line has a note, so the new one is a line of its own.
    const more = { ...o, lines: addLine(o.lines, latte.variantId) };
    expect(more.lines).toHaveLength(2);
    expect(orderDue(more, byId, money, NO_ADDONS_MENU).toFixed()).toBe("7500");
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
    expect(orderDue(orderFromBill(repriced), byId, money, NO_ADDONS_MENU).toFixed()).toBe("6000");
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

  it("says a unit counted one by one in the reader's language, and a symbol as it is", () => {
    const ckb = (k: string) => ({ each: "دانە" })[k] ?? k;
    expect(unitName("each", ckb)).toBe("دانە");
    expect(unitName("g", ckb)).toBe("g");
    expect(unitName("Carton of 24", ckb)).toBe("Carton of 24");
    const cup = { baseUnit: "each", units: [{ code: "each", label: "each", factor: 1 }] };
    expect(showIn(new Decimal(3), cup, "each", ckb)).toBe("3 دانە");
    expect(showNice(new Decimal(3), cup, "each", ckb)).toBe("3 دانە");
    // Without the reader's words, as before: in English.
    expect(showIn(new Decimal(3), cup, "each")).toBe("3 each");
    expect(showIn(new Decimal(4600), gelato, "kg", ckb)).toBe("4.6 kg");
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
    const ar = translator(builtInWords("ar"));
    const ckb = translator(builtInWords("ckb"));
    expect(channelName(CHANNELS, "dine_in", "ar", ar)).toBe("تناول في المكان");
    expect(channelName(CHANNELS, "takeaway", "ckb", ckb)).toBe("بردن");
    expect(channelName(CHANNELS, "talabat", "ar", ar)).toBe("طلبات");
    expect(channelName(CHANNELS, "talabat", "ckb", ckb)).toBe("Talabat"); // no Kurdish name given
    expect(channelName(CHANNELS, "lezzoo", "ckb", ckb)).toBe("لێزۆ");
    expect(channelName(CHANNELS, "lezzoo", "en")).toBe("Lezzoo");
    expect(channelName(CHANNELS, "careem", "ar", ar)).toBe("Careem");
    // With no translator (a CSV): the shop's own in English.
    expect(channelName(CHANNELS, "dine_in", "en")).toBe("Dine-in");
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

describe("the drawer's count, as the form takes it (0036): blind", () => {
  it("keeps everything in the drawer when nothing is said", () => {
    expect(closeSplit("29000", "")).toEqual({ counted: 29000, left: 29000, taken: 0, error: null });
  });
  it("takes the rest to the safe or the bank", () => {
    expect(closeSplit("28,500", "25000")).toEqual({
      counted: 28500,
      left: 25000,
      taken: 3500,
      error: null,
    });
  });
  it("refuses to leave more than was counted", () => {
    expect(closeSplit("1000", "2000").error).toMatch(/between 0/);
  });
  it("reads the cash typed in Arabic-Indic digits", () => {
    expect(closeSplit("٢٩٠٠٠", "").counted).toBe(29000);
  });
  it("says nothing until something is counted", () => {
    expect(closeSplit("", "")).toEqual({ counted: null, left: null, taken: null, error: null });
  });
  it("adds up the notes counted, one kind at a time", () => {
    expect(notesTotal({ "25000": "2", "1000": "3", "250": "" })).toBe(53000);
    expect(notesTotal({ "1000": "٣" })).toBe(3000);
    expect(notesTotal({ "1000": "1.5" })).toBeNull();
    expect(notesCounted({ "25000": "2", "1000": "0", "250": "" })).toEqual({ "25000": 2 });
    expect(notesCounted({ "1000": "" })).toBeNull();
  });
  it("reads the database's answer: what it should have held comes only with it", () => {
    const r = countResult({
      session_no: 7,
      expected: 29000,
      counted: 28500,
      variance: -500,
      left: 25000,
      taken: 3500,
      taken_to: "safe",
      journal_no: 1042,
      cash_sales: 7500,
      refunds: 0,
      voids: 2500,
      paid_out: 1000,
      cash_in: 25000,
      cash_out: 0,
      card: 2500,
      orders: 4,
      moved: 29000,
    });
    expect(r).toMatchObject({
      sessionNo: 7,
      expected: 29000,
      variance: -500,
      taken: 3500,
      takenTo: "safe",
      journalNo: 1042,
    });
    expect(r.figures).toMatchObject({ cashSales: 7500, voids: 2500, card: 2500, orders: 4 });
    const closedBlind = countResult({
      session_no: 8,
      expected: 6000,
      counted: null,
      variance: null,
      left: 6000,
      taken: 0,
    });
    expect(closedBlind).toMatchObject({ counted: null, variance: null, left: 6000, figures: null });
  });
  it("tells the till whose session is open, and never what it should hold unless allowed", () => {
    const d = drawerStateFrom({
      location: "Main Branch",
      drawer: "Till",
      open: true,
      may_close: true,
      sees_expected: false,
      expected: null,
      figures: null,
      open_bills: 2,
      session: {
        id: "s1",
        no: 3,
        cashier_id: "c1",
        cashier: "Rawand",
        opened_at: "2026-09-27T05:00:00Z",
        opened_by: "Rawand",
        mine: true,
      },
      takers: [{ id: "m1", name: "Lana" }],
    });
    expect(d).toMatchObject({
      open: true,
      mayClose: true,
      seesExpected: false,
      expected: null,
      openBills: 2,
    });
    expect(d.session).toMatchObject({ no: 3, cashier: "Rawand", mine: true });
    expect(d.takers).toEqual([{ id: "m1", name: "Lana" }]);
    expect(drawerStateFrom(null)).toMatchObject({ open: false, session: null, mayOpen: false });
  });
});

describe("what the safe and the drawer hold, under Paid from (AK)", () => {
  const held: CashOnHand = { safe: 500, till: 12000, tillOpen: true };

  it("says what the safe holds, and warns when the payment is more", () => {
    expect(cashNote(held, "safe", 500)).toEqual({
      text: "The safe holds {amount} in the books.",
      amount: 500,
      warn: false,
    });
    expect(cashNote(held, "safe", 1000)).toMatchObject({ amount: 500, warn: true });
    expect(cashNote(held, "safe", 1000)?.text).toMatch(/not enough to pay this/);
  });

  it("says what the drawer should hold, only to those who may see it", () => {
    expect(cashNote(held, "till", 12000)).toEqual({
      text: "The drawer should hold {amount}.",
      amount: 12000,
      warn: false,
    });
    expect(cashNote(held, "till", 12250)).toMatchObject({ amount: 12000, warn: true });
    // A bill's payment names the till "cash".
    expect(cashNote(held, "cash", 12250)).toMatchObject({ amount: 12000, warn: true });
    // The count is blind: a reader who may not see it is told nothing.
    expect(cashNote({ ...held, till: null }, "till", 99999999)).toBeNull();
  });

  it("warns that nothing is paid out of a drawer not open, to anyone", () => {
    for (const till of [12000, null])
      expect(cashNote({ safe: 500, till, tillOpen: false }, "till", 1)).toEqual({
        text: "The drawer is not open: open it on the till first, or pay it from elsewhere.",
        amount: null,
        warn: true,
      });
  });

  it("says nothing of the bank, a card or the owner, nor before a source is chosen", () => {
    for (const from of ["bank", "card", "owner", "transfer", ""])
      expect(cashNote(held, from, 1_000_000)).toBeNull();
    expect(cashNote(null, "safe", 1_000_000)).toBeNull();
  });

  it("says each of it in Arabic and Kurdish", () => {
    const said = [
      cashNote(held, "safe", 1),
      cashNote(held, "safe", 1000),
      cashNote(held, "till", 1),
      cashNote(held, "till", 13000),
      cashNote({ ...held, tillOpen: false }, "till", 1),
    ];
    for (const locale of ["ar", "ckb"] as const) {
      const t = translator(builtInWords(locale));
      for (const note of said) {
        const text = t(note!.text, { amount: "500" });
        expect(text).not.toBe(note!.text.replace("{amount}", "500"));
        expect(text).not.toMatch(/[A-Za-z]{2,}/);
      }
    }
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
  it("either is written to the app's log as one line: the function, and what the person saw", () => {
    expect(
      JSON.parse(
        rpcLogLine("record_advance", "refused", {
          code: "P0001",
          status: 400,
          message: "The till holds 15,000 IQD",
        }),
      ),
    ).toEqual({
      at: "rpc",
      fn: "record_advance",
      outcome: "refused",
      code: "P0001",
      status: 400,
      message: "The till holds 15,000 IQD",
    });
    expect(JSON.parse(rpcLogLine("record_sale", "uncertain"))).toEqual({
      at: "rpc",
      fn: "record_sale",
      outcome: "uncertain",
    });
    const long = JSON.parse(rpcLogLine("f", "refused", { message: "x".repeat(1000) }));
    expect(long.message).toHaveLength(300);
    expect(rpcLogLine("f", "refused").includes("\n")).toBe(false);
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
    expect(auditGroup("prices")?.prefixes).toEqual(["price.", "modifier_price."]);
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
  // The migrations that define a function, in the order they run.
  const defining = (fn: string) => {
    const dir = join(__dirname, "../supabase/migrations");
    return readdirSync(dir)
      .sort()
      .map((f) => readFileSync(join(dir, f), "utf8"))
      .filter((sql) => sql.includes(`create or replace function ${fn}(`));
  };
  // The thresholds as the latest migration to redefine them has them.
  const migration = defining("alert_threshold_rules").at(-1) ?? "";
  // The rules, as every migration that added to them wrote them (none is taken away):
  // each definition of the function, not the rest of its migration.
  const rules = defining("alert_conditions")
    .flatMap((sql) => sql.split("create or replace function alert_conditions(").slice(1))
    .map((body) => body.slice(0, body.indexOf("$$;")))
    .join("\n");
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

  it("red alerts of one rule: the first two shown, the rest under one row, none folded away", () => {
    const red = (id: string, rule: string) => alert({ id, rule, urgency: "red" });
    const g = splitRed([
      red("bank", "cash_negative"),
      red("a", "running_out"),
      red("b", "running_out"),
      red("c", "running_out"),
      red("d", "running_out"),
      red("u", "use_by"),
    ]);
    expect(g.map((x) => [x.rule, x.shown.map((a) => a.id), x.more.map((a) => a.id)])).toEqual([
      ["cash_negative", ["bank"], []],
      ["running_out", ["a", "b"], ["c", "d"]],
      ["use_by", ["u"], []],
    ]);
    expect(g.flatMap((x) => [...x.shown, ...x.more])).toHaveLength(6);
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

describe("names that look alike, before a new item is added (release H)", () => {
  const items = [
    { id: "w", name: "Bottled water", nameAr: "ماء معبأ", nameCkb: "ئاوی بوتڵ" },
    { id: "s", name: "Sugar", nameAr: "سكر", nameCkb: "شەکر" },
    { id: "m", name: "Mocha syrup" },
    { id: "c", name: "Cup 8oz" },
    { id: "r", name: "Rice" },
    { id: "k", name: "Milk", nameAr: "حليب", nameCkb: "شیر" },
  ];
  const found = (name: string, extra: { nameAr?: string; nameCkb?: string } = {}) =>
    lookAlikes({ name, ...extra }, items).map((l) => (l.same ? `=${l.name}` : l.name));

  it("the same name, as the database sees it: capitals, spaces and punctuation aside", () => {
    expect(nameKey("  Bottled-WATER! ")).toBe("bottledwater");
    expect(found("bottled  water")).toEqual(["=Bottled water"]);
    expect(found("BOTTLED WATER.")).toEqual(["=Bottled water"]);
  });

  it("a slip of the keyboard: a letter missing, extra, wrong or two swapped", () => {
    expect(slips("botled", "bottled")).toBe(1);
    expect(slips("mlik", "milk")).toBe(1);
    expect(found("Botled water")).toEqual(["Bottled water"]);
    expect(found("Suger")).toEqual(["Sugar"]);
    expect(found("Mlik")).toEqual(["Milk"]);
    expect(found("Bottled waters")).toEqual(["Bottled water"]);
    expect(found("Water bottled")).toEqual(["Bottled water"]);
  });

  it("Arabic and Kurdish letter forms one hand writes for another", () => {
    // ی for ي, ک for ك, ە for ه: the same word to the reader.
    expect(lookAlike("شير", "شیر")).toBe(0);
    expect(lookAlike("سکر", "سكر")).toBe(0);
    expect(found("Fresh milk", { nameCkb: "شير" })).toEqual(["Milk"]);
    expect(found("Sugar cubes", { nameAr: "سکر" })).toEqual(["Sugar"]);
    expect(found("Water", { nameAr: "مآء معبأ" })).toEqual(["Bottled water"]);
  });

  it("different items are not warned about", () => {
    // Another size, another word with one letter changed, another first letter.
    expect(found("Cup 12oz")).toEqual([]);
    expect(found("Matcha syrup")).toEqual([]);
    expect(found("Ice")).toEqual([]);
    expect(found("Milk powder")).toEqual([]);
    expect(found("Salt")).toEqual([]);
    expect(found("Tea")).toEqual([]);
  });

  it("the closest first, three at most", () => {
    const many = ["Vanila syrups", "Vanila syrup", "Vanilla syrup", "Vanilla syrups"].map(
      (name, i) => ({ id: String(i), name }),
    );
    const list = lookAlikes({ name: "vanilla SYRUP" }, many);
    expect(list.map((l) => l.name)).toEqual(["Vanilla syrup", "Vanila syrup", "Vanilla syrups"]);
    expect(list[0]).toEqual({ id: "2", name: "Vanilla syrup", same: true });
    // A one-letter word is a name of its own: "Syrup A" is not "Syrup B".
    expect(lookAlikes({ name: "Syrup A" }, [{ id: "b", name: "Syrup B" }])).toEqual([]);
    expect(lookAlikes({ name: "  " }, many)).toEqual([]);
  });

  it("the pack an item is bought in gets a code made from what it is called", () => {
    expect(packCode("Carton of 24", 24)).toBe("carton_of_24");
    expect(packCode("  Box (12) ", 12)).toBe("box_12");
    expect(packCode("Sack — 25 kg", 25000)).toBe("sack_25_kg");
    expect(packCode("Crème tub", 1000)).toBe("creme_tub");
    // A name in Arabic or Kurdish letters: pack_ and its size.
    expect(packCode("کارتۆن", 24)).toBe("pack_24");
    expect(packCode("علبة", 0.5)).toBe("pack_0_5");
  });
});

describe("the barista's ticket (release I)", () => {
  const l = (variantId: string, qty: number, note: string | null = null) => ({
    variantId,
    qty,
    note,
    addons: [],
  });

  it("sends a new order whole, and what is added to it after", () => {
    expect(ticketChanges([], [l("latte", 2), l("water", 1)])).toEqual({
      added: [l("latte", 2), l("water", 1)],
      removed: [],
    });
    expect(ticketChanges([l("latte", 2)], [l("latte", 3), l("water", 1)])).toEqual({
      added: [l("latte", 1), l("water", 1)],
      removed: [],
    });
  });

  it("tells the bar what was taken off, so it is not made", () => {
    expect(ticketChanges([l("latte", 2), l("water", 1)], [l("latte", 1)])).toEqual({
      added: [],
      removed: [l("latte", 1), l("water", 1)],
    });
  });

  it("has nothing to say when nothing the bar makes has changed", () => {
    const lines = [l("latte", 2), l("water", 1, "cold")];
    expect(ticketChanges(lines, [l("water", 1, " cold "), l("latte", 2)])).toEqual({
      added: [],
      removed: [],
    });
  });

  it("counts the same product on two lines together, and a new note as another way to make it", () => {
    expect(ticketChanges([l("latte", 1), l("latte", 1)], [l("latte", 2)])).toEqual({
      added: [],
      removed: [],
    });
    expect(ticketChanges([l("latte", 2)], [l("latte", 1), l("latte", 1, "oat milk")])).toEqual({
      added: [l("latte", 1, "oat milk")],
      removed: [l("latte", 1)],
    });
  });

  it("takes an order's lines as the bar needs them: what, how many and how", () => {
    expect(
      ticketLines([
        {
          key: "k1",
          variantId: "latte",
          qty: 2,
          note: "oat milk",
          lineId: "l1",
          fallbackName: null,
          billPrice: 2500,
          addons: [],
        },
      ]),
    ).toEqual([l("latte", 2, "oat milk")]);
  });
});

describe("refunds by the item (0037), as the database works them out", () => {
  const espresso = (refundedQty = 0, refundedAmount = 0): RefundableLine => ({
    id: "e",
    name: "Golden espresso — Single",
    qty: 3,
    lineNet: 7000,
    refundedQty,
    refundedAmount,
  });
  const water: RefundableLine = {
    id: "w",
    name: "Golden water — Bottle",
    qty: 2,
    lineNet: 2000,
    refundedQty: 0,
    refundedAmount: 0,
  };

  it("rounds to whole dinars, half to even, as money_round does", () => {
    expect([roundMoney(2333.33), roundMoney(2.5), roundMoney(3.5), roundMoney(1062.5)]).toEqual([
      2333, 2, 4, 1062,
    ]);
    expect([
      shareOf(7000, 1, 3),
      shareOf(7000, 2, 3),
      shareOf(4250, 1, 4),
      shareOf(4750, 1, 4),
    ]).toEqual([2333, 4667, 1062, 1188]);
  });

  it("gives each its share of the net, and the last of a line all that is left", () => {
    expect(refundLineAmount(espresso(), 1)).toBe(2333);
    expect(refundLineAmount(espresso(1, 2333), 1)).toBe(2333);
    expect(refundLineAmount(espresso(2, 4666), 1)).toBe(2334);
    expect(refundLineAmount(espresso(), 3)).toBe(7000);
    expect(refundLineAmount(espresso(), 0)).toBe(0);
  });

  it("plans the refund the screen sends, checked as the database checks it", () => {
    expect(refundPlan([espresso(), water], { e: "1", w: "" })).toEqual({
      lines: [{ lineId: "e", qty: 1, amount: 2333 }],
      total: 2333,
      problem: null,
    });
    // Arabic-Indic digits are counted too.
    expect(refundPlan([espresso(), water], { e: "", w: "١" }).total).toBe(1000);
    expect(refundPlan([espresso(1, 2333), water], { e: "3" }).problem).toEqual({
      kind: "tooMany",
      name: "Golden espresso — Single",
      left: 2,
    });
    expect(refundPlan([espresso(), water], { e: "x" }).problem).toEqual({
      kind: "notNumber",
      name: "Golden espresso — Single",
    });
    expect(refundPlan([espresso(), water], { e: "", w: "0" }).problem).toEqual({ kind: "nothing" });
  });

  it("starts from all that is left of the sale", () => {
    expect(allThatIsLeft([espresso(1, 2333), water])).toEqual({ e: "2", w: "2" });
    expect(allThatIsLeft([espresso(3, 7000)])).toEqual({ e: "" });
    const all = refundPlan([espresso(1, 2333), water], allThatIsLeft([espresso(1, 2333), water]));
    expect(all.total).toBe(7000 - 2333 + 2000);
  });
});

describe("the café's rules on Settings (0040, release O)", () => {
  // The rules as the latest migration to define them has them.
  const dir = join(__dirname, "../supabase/migrations");
  const sql =
    readdirSync(dir)
      .sort()
      .map((f) => readFileSync(join(dir, f), "utf8"))
      .filter((s) => s.includes("create or replace function rule_definitions("))
      .at(-1) ?? "";
  const body = sql.slice(sql.indexOf("create or replace function rule_definitions("));
  const json = body.match(/select '(\{[\s\S]*?\})'::jsonb/)?.[1] ?? "{}";
  const defs = JSON.parse(json.replace(/''/g, "'")) as Record<
    string,
    { kind: string; choices?: string[]; scopes: string[] }
  >;

  it("the screen knows every rule the database keeps, and every way each is set", () => {
    expect(Object.keys(defs).sort()).toEqual([...RULE_ORDER].sort());
    for (const [k, d] of Object.entries(defs)) {
      for (const c of d.choices ?? []) expect(CHOICE_LABEL[c], `${k}: ${c}`).toBeTruthy();
      for (const s of d.scopes) expect(SCOPE_LABEL[s as ScopeType], `${k}: ${s}`).toBeTruthy();
    }
  });

  it("reads a value typed for a rule as the database checks it", () => {
    const parsed = parseBusinessRules({ definitions: defs, rows: [], history: [] });
    const def = (k: string) => parsed.definitions.find((d) => d.key === k)!;
    expect(typedRuleValue(def("discount_cap_percent"), "12.5")).toEqual({ ok: true, value: 12.5 });
    expect(typedRuleValue(def("discount_cap_percent"), "101").ok).toBe(false);
    expect(typedRuleValue(def("discount_cap_percent"), "x")).toEqual({
      ok: false,
      error: "Enter a number",
    });
    expect(typedRuleValue(def("discount_round_to"), "12.5")).toEqual({
      ok: false,
      error: "Enter a whole number",
    });
    expect(typedRuleValue(def("discount_round_to"), "1,000")).toEqual({ ok: true, value: 1000 });
    expect(typedRuleValue(def("negative_stock"), "approve")).toEqual({
      ok: true,
      value: "approve",
    });
    expect(typedRuleValue(def("negative_stock"), "maybe").ok).toBe(false);
  });

  it("reads the rows and the changes as the database lists them, in the screen's order", () => {
    const r = parseBusinessRules({
      definitions: defs,
      rows: [
        {
          key: "negative_stock",
          scope_type: "item_type",
          scope_id: "finished_good",
          value: "block",
          is_default: true,
        },
        { key: "no_such_rule", scope_type: "business", scope_id: "", value: 1 },
      ],
      history: [
        {
          key: "discount_cap_percent",
          scope_type: "role",
          scope_id: "cashier",
          old_value: null,
          new_value: 5,
          reason: "Cashiers give 5% at most",
          changed_by: "Demo Owner",
          changed_at: "2026-09-27T10:00:00Z",
        },
      ],
    });
    expect(r.definitions.map((d) => d.key)).toEqual([...RULE_ORDER]);
    expect(r.rows).toEqual([
      {
        key: "negative_stock",
        scopeType: "item_type",
        scopeId: "finished_good",
        scopeName: null,
        value: "block",
        isDefault: true,
        reason: null,
        setBy: null,
        setAt: null,
      },
    ]);
    expect(r.history[0]).toMatchObject({
      scopeType: "role",
      oldValue: null,
      newValue: 5,
      changedBy: "Demo Owner",
    });
  });
});

describe("sizes and add-ons at the till (0041)", () => {
  const money: MoneyRules = { decimals: 0, discountStep: 500 };
  const size = (variantId: string, variantName: string, price: number): PosItem => ({
    variantId,
    productId: "p-esp",
    productName: "Espresso",
    variantName,
    nameAr: null,
    nameCkb: null,
    category: null,
    categoryId: null,
    categorySort: null,
    categoryAr: null,
    categoryCkb: null,
    imageUrl: null,
    isFavourite: false,
    prices: { dine_in: price, takeaway: price },
  });
  const regular = size("v-reg", "Regular", 2500);
  const triple = size("v-tri", "Triple", 4000);
  const byId = new Map([regular, triple].map((i) => [i.variantId, i]));
  const addon = (id: string, groupId: string, name: string, prices: Record<string, number>) => ({
    id,
    groupId,
    name,
    nameAr: name === "Oat milk" ? "حليب الشوفان" : null,
    nameCkb: null,
    prices,
  });
  const whole = addon("m-whole", "g-milk", "Whole milk", { dine_in: 0, takeaway: 0 });
  const oat = addon("m-oat", "g-milk", "Oat milk", { dine_in: 500, takeaway: 500 });
  const shot = addon("m-shot", "g-extra", "Extra shot", { dine_in: 750, takeaway: 750 });
  // Sold at a table only: a takeaway cup has no room for it.
  const cream = addon("m-cream", "g-top", "Whipped cream", { dine_in: 250 });
  const group = (
    id: string,
    name: string,
    min: number,
    max: number | null,
    addons: (typeof oat)[],
  ) => ({
    id,
    name,
    nameAr: null,
    nameCkb: null,
    min,
    max,
    addons,
  });
  const milk = group("g-milk", "Milk", 1, 1, [whole, oat]);
  const extras = group("g-extra", "Extras", 0, 3, [shot]);
  const toppings = group("g-top", "Toppings", 0, null, [cream]);
  const menu = addonMenu({
    // The till's order: extras first; the milk asks for a choice, so it comes first all the same.
    groups: [extras, toppings, milk],
    offers: [
      { productId: "p-esp", variantId: null, groupId: "g-milk" },
      { productId: "p-esp", variantId: "v-tri", groupId: "g-extra" },
      { productId: "p-esp", variantId: null, groupId: "g-top" },
    ],
  });
  const oatAndTwoShots = [
    { modifierId: "m-oat", qty: 1 },
    { modifierId: "m-shot", qty: 2 },
  ];

  it("asks for the groups a size offers, those that need a choice first", () => {
    expect(menu.groupsFor("p-esp", "v-reg").map((g) => g.name)).toEqual(["Milk", "Toppings"]);
    expect(menu.groupsFor("p-esp", "v-tri").map((g) => g.name)).toEqual([
      "Milk",
      "Extras",
      "Toppings",
    ]);
    expect(menu.groupsFor("p-tea", "v-tea")).toEqual([]);
  });

  it("adds a line only when every group has what it asks for, and no more", () => {
    const groups = menu.groupsFor("p-esp", "v-tri");
    expect(addonsMissing(groups, [])).toEqual({ group: milk, kind: "fewer" });
    expect(addonsMissing(groups, oatAndTwoShots)).toBeNull();
    expect(
      addonsMissing(groups, [
        { modifierId: "m-oat", qty: 1 },
        { modifierId: "m-shot", qty: 4 },
      ]),
    ).toEqual({ group: extras, kind: "more" });
    expect(
      addonsMissing(groups, [
        { modifierId: "m-oat", qty: 1 },
        { modifierId: "m-whole", qty: 1 },
      ]),
    ).toEqual({ group: milk, kind: "more" });
  });

  it("prices one of a line as the database does: the size, and each add-on as many times as it is added", () => {
    const line = addLine([], "v-tri", oatAndTwoShots)[0]!;
    // 4,000 + 500 + 750 × 2
    expect(linePrice(line, byId, "dine_in", menu)).toBe(6000);
    // No price on the channel for one of its add-ons: the line cannot be priced.
    const withCream = addLine([], "v-reg", [
      { modifierId: "m-whole", qty: 1 },
      { modifierId: "m-cream", qty: 1 },
    ])[0]!;
    expect(linePrice(withCream, byId, "dine_in", menu)).toBe(2750);
    expect(linePrice(withCream, byId, "takeaway", menu)).toBeNull();
  });

  it("puts one more on a line only with the same add-ons, in whatever order they were chosen", () => {
    let lines = addLine([], "v-tri", oatAndTwoShots);
    lines = addLine(lines, "v-tri", [...oatAndTwoShots].reverse());
    expect(lines).toHaveLength(1);
    expect(lines[0]!.qty).toBe(2);
    lines = addLine(lines, "v-tri", [{ modifierId: "m-whole", qty: 1 }]);
    expect(lines).toHaveLength(2);
    const o = { ...quickOrder("dine_in"), lines };
    // 2 × 6,000 + 4,000
    expect(orderSubtotal(o, byId, money, menu).toFixed()).toBe("16000");
  });

  it("keeps a printed bill's price for an add-on, for more of it too", () => {
    const printed: OpenBill = {
      tabId: "t9",
      version: 2,
      tableId: null,
      tableName: null,
      label: "Table 9",
      channel: "dine_in",
      businessDay: "2026-09-25",
      openedAt: "2026-09-25T18:00:00Z",
      openedBy: null,
      billPrintedAt: "2026-09-25T19:00:00Z",
      billPrintCount: 1,
      lines: [
        {
          lineId: "l9",
          variantId: "v-reg",
          qty: 1,
          note: null,
          productName: "Espresso",
          variantName: "Regular",
          price: 2500,
          // Oat milk was 400 when the bill was printed; the menu has 500 now.
          modifiers: [
            {
              modifierId: "m-oat",
              name: "Oat milk",
              nameAr: null,
              nameCkb: null,
              qty: 1,
              price: 400,
            },
          ],
        },
      ],
      subtotal: 2900,
      discount: 0,
      discountPercent: null,
      discountAmount: null,
      total: 2900,
    };
    const o = orderFromBill(printed);
    expect(billChanged(o, printed)).toBe(false);
    expect(orderDue(o, byId, money, menu).toFixed()).toBe("2900");
    // Another oat-milk regular goes onto the line; a triple with oat milk is at the bill's 400 too.
    const more = {
      ...o,
      lines: addLine(addLine(o.lines, "v-reg", [{ modifierId: "m-oat", qty: 1 }]), "v-tri", [
        { modifierId: "m-oat", qty: 1 },
      ]),
    };
    expect(more.lines.map((l) => l.qty)).toEqual([2, 1]);
    expect(orderDue(more, byId, money, menu).toFixed()).toBe("10200");
    // Another till took the oat milk off: the bill on screen is out of date.
    const changed = { ...printed, lines: [{ ...printed.lines[0]!, modifiers: [] }] };
    expect(billChanged(o, changed)).toBe(true);
  });

  it("names a line's add-ons in the reader's language, and one gone from the menu by its bill name", () => {
    expect(addonNames(oatAndTwoShots, menu, "en")).toEqual(["Oat milk", "Extra shot ×2"]);
    expect(addonNames([{ modifierId: "m-oat", qty: 1 }], menu, "ar")).toEqual(["حليب الشوفان"]);
    expect(
      addonNames([{ modifierId: "m-gone", qty: 1 }], menu, "en", [
        { modifierId: "m-gone", qty: 1, billPrice: 300, fallbackName: "Hazelnut" },
      ]),
    ).toEqual(["Hazelnut"]);
  });

  it("tells the bar a line with other add-ons is another way to make it", () => {
    const t = (addons: { modifierId: string; qty: number }[], qty = 1) => ({
      variantId: "v-tri",
      qty,
      note: null,
      addons,
    });
    expect(ticketChanges([t(oatAndTwoShots)], [t([...oatAndTwoShots].reverse(), 2)])).toEqual({
      added: [t([...oatAndTwoShots].reverse(), 1)],
      removed: [],
    });
    expect(ticketChanges([t(oatAndTwoShots)], [t([{ modifierId: "m-whole", qty: 1 }])])).toEqual({
      added: [t([{ modifierId: "m-whole", qty: 1 }])],
      removed: [t(oatAndTwoShots)],
    });
  });

  it("marks a bill changed when a line's add-ons are", () => {
    const lines = addLine([], "v-reg", [{ modifierId: "m-whole", qty: 1 }]);
    expect(signature(lines, null)).not.toBe(
      signature(addLine([], "v-reg", [{ modifierId: "m-oat", qty: 1 }]), null),
    );
  });
});

describe("split payments (0042), as the database takes them", () => {
  it("takes the rest in the last payment, left empty", () => {
    const c = checkSplit(
      6000,
      [
        { type: "card", amount: "4000" },
        { type: "cash", amount: "" },
      ],
      "5000",
    );
    expect(c.problem).toBeNull();
    expect(c.rest).toBe(2000);
    expect(c.change).toBe(3000);
    expect(c.payments).toEqual([
      { type: "card", amount: 4000, received: null },
      { type: "cash", amount: 2000, received: 5000 },
    ]);
  });

  it("reads amounts typed in Arabic or Kurdish digits", () => {
    const c = checkSplit(
      3500,
      [
        { type: "cash", amount: "١٥٠٠" },
        { type: "card", amount: "۲۰۰۰" },
      ],
      "",
    );
    expect(c.payments).toEqual([
      { type: "cash", amount: 1500, received: null },
      { type: "card", amount: 2000, received: null },
    ]);
  });

  it("refuses what the database would", () => {
    const two = (a: string, b: string) => [
      { type: "card" as const, amount: a },
      { type: "cash" as const, amount: b },
    ];
    expect(checkSplit(6000, two("7000", ""), "").problem).toBe("over");
    expect(checkSplit(6000, two("7000", ""), "").rest).toBe(-1000);
    expect(checkSplit(6000, two("1000", "4000"), "").problem).toBe("short");
    expect(checkSplit(6000, two("1000", "4000"), "").short).toBe(1000);
    expect(checkSplit(6000, two("5000", "2000"), "").over).toBe(1000);
    expect(checkSplit(6000, two("6000", ""), "").problem).toBe("zero");
    expect(checkSplit(6000, two("0", "6000"), "").problem).toBe("zero");
    expect(checkSplit(6000, two("", "2000"), "").problem).toBe("missing");
    expect(checkSplit(6000, two("40.5", ""), "").problem).toBe("notNumber");
    expect(checkSplit(6000, two("4000", ""), "abc").problem).toBe("notNumber");
    const short = checkSplit(6000, two("4000", ""), "1500");
    expect(short.problem).toBe("cashShort");
    expect(short.change).toBeNull();
    expect(short.payments).toBeNull();
  });

  it("splits between two cards, with no cash to hand over", () => {
    const c = checkSplit(
      1000,
      [
        { type: "card", amount: "400" },
        { type: "card", amount: "" },
      ],
      "",
    );
    expect(c.cash).toBeNull();
    expect(c.payments?.map((p) => p.amount)).toEqual([400, 600]);
  });

  it("sends the list, or the one tender of a payment left waiting by an older till", () => {
    expect(howPaid({ tenders: [{ type: "cash", amount: "2500", received: "10000" }] })).toEqual({
      p_tender: null,
      p_tenders: [{ type: "cash", amount: 2500, received: 10000 }],
    });
    expect(howPaid({ tender: "card" })).toEqual({ p_tender: "card", p_tenders: null });
    expect(howPaid({})).toBeNull();
  });

  it("reads the recorded payments and the change they gave", () => {
    const r = saleReceipt({
      order_id: "o1",
      net: 6000,
      payments: [
        { type: "cash", amount: 2000, received: 5000, change: 3000 },
        { type: "card", amount: 4000, received: null, change: null },
      ],
    });
    expect(r.payments[1]).toEqual({ type: "card", amount: 4000, received: null, change: null });
    expect(changeGiven(r.payments)).toBe(3000);
    expect(changeGiven([{ change: null }])).toBeNull();
    expect(saleReceipt({ order_id: "o2", net: 1 }).payments).toEqual([]);
  });

  it("shares a refund over what is left of each payment, as allocate_landed does", () => {
    expect(proportionalParts([2000, 4000], 1000)).toEqual([333, 667]);
    expect(proportionalParts([2000, 4000], 6000)).toEqual([2000, 4000]);
    expect(proportionalParts([0, 2500], 2500)).toEqual([0, 2500]);
    // Equal remainders: the first takes the odd dinar.
    expect(proportionalParts([1000, 1000], 1001)).toEqual([501, 500]);
    expect(proportionalParts([3, 3, 3], 2)).toEqual([1, 1, 0]);
    expect(proportionalParts([100, 200], 0)).toEqual([0, 0]);
  });

  it("knows what is left of each way a sale was paid", () => {
    const left = leftToGiveBack(
      [
        { type: "cash", amount: 2000 },
        { type: "card", amount: 4000 },
      ],
      [
        { type: "cash", amount: 333 },
        { type: "card", amount: 667 },
      ],
    );
    expect(left).toEqual([
      { type: "cash", paid: 2000, left: 1667 },
      { type: "card", paid: 4000, left: 3333 },
    ]);
    // A refund from before 0037 took from the sale's one payment.
    expect(leftToGiveBack([{ type: "cash", amount: 2500 }], [], 500)).toEqual([
      { type: "cash", paid: 2500, left: 2000 },
    ]);
    // Two cards are one way to give back.
    expect(
      leftToGiveBack(
        [
          { type: "card", amount: 400 },
          { type: "card", amount: 600 },
        ],
        [],
      ),
    ).toEqual([{ type: "card", paid: 1000, left: 1000 }]);
  });

  it("checks a refund's parts as the database does, and says it in its words", () => {
    const left = [
      { type: "cash" as const, paid: 2000, left: 1667 },
      { type: "card" as const, paid: 4000, left: 3333 },
    ];
    expect(checkRefundSplit(left, { cash: "1667", card: "833" }, 2500)).toEqual({
      parts: [
        { type: "cash", amount: 1667 },
        { type: "card", amount: 833 },
      ],
      problem: null,
    });
    const tooMuch = checkRefundSplit(left, { cash: "2500", card: "" }, 2500);
    expect(tooMuch.problem).toEqual({ kind: "tooMuch", type: "cash", left: 1667 });
    expect(refundSplitMessage(tooMuch.problem!, 2500)).toBe(
      "Only 1667 of the cash paid is left to give back",
    );
    const sum = checkRefundSplit(left, { cash: "1000", card: "1000" }, 2500);
    expect(refundSplitMessage(sum.problem!, 2500)).toBe(
      "The refund is 2500, but the payments given back come to 2000",
    );
    expect(checkRefundSplit(left, { cash: "x" }, 2500).problem).toEqual({ kind: "notNumber" });
  });
});

describe("US dollars at the till (0043), as the database takes them", () => {
  it("values dollars at the rate, to the café's step, half-way up", () => {
    expect(usdValue(5, 1310, 250)).toBe(6500); // 6,550
    expect(usdValue(2, 1310, 250)).toBe(2500); // 2,620
    expect(usdValue(10, 1310, 250)).toBe(13000); // 13,100
    expect(usdValue(20, 1310, 250)).toBe(26250); // 26,200
    expect(usdValue(1, 1375, 250)).toBe(1500); // 1,375: half-way rounds up
    expect(usdValue(7, 1310, 500)).toBe(9000); // 9,170
    expect(usdValue(7, 1310, 250)).toBe(9250);
  });

  it("gives the till's value as the database works it out, on 60 cases", () => {
    // [usd, rate, step, the database's usd_value]: floor(usd × rate / step + 0.5) × step.
    const cases: [number, number, number, number][] = [
      [38, 1053, 50, 40000],
      [75, 1106, 100, 83000],
      [112, 1159, 250, 129750],
      [149, 1212, 500, 180500],
      [186, 1265, 1000, 235000],
      [23, 1318, 1, 30314],
      [60, 1371, 50, 82250],
      [97, 1424, 100, 138100],
      [134, 1477, 250, 198000],
      [171, 1530, 500, 261500],
      [8, 1583, 1000, 13000],
      [45, 1636, 1, 73620],
      [82, 1039, 50, 85200],
      [119, 1092, 100, 129900],
      [156, 1145, 250, 178500],
      [193, 1198, 500, 231000],
      [30, 1251, 1000, 38000],
      [67, 1304, 1, 87368],
      [104, 1357, 50, 141150],
      [141, 1410, 100, 198800],
      [178, 1463, 250, 260500],
      [15, 1516, 500, 22500],
      [52, 1569, 1000, 82000],
      [89, 1622, 1, 144358],
      [126, 1025, 50, 129150],
      [163, 1078, 100, 175700],
      [200, 1131, 250, 226250],
      [37, 1184, 500, 44000],
      [74, 1237, 1000, 92000],
      [111, 1290, 1, 143190],
      [148, 1343, 50, 198750],
      [185, 1396, 100, 258300],
      [22, 1449, 250, 32000],
      [59, 1502, 500, 88500],
      [96, 1555, 1000, 149000],
      [133, 1608, 1, 213864],
      [170, 1011, 50, 171850],
      [7, 1064, 100, 7400],
      [44, 1117, 250, 49250],
      [81, 1170, 500, 95000],
      [118, 1223, 1000, 144000],
      [155, 1276, 1, 197780],
      [192, 1329, 50, 255150],
      [29, 1382, 100, 40100],
      [66, 1435, 250, 94750],
      [103, 1488, 500, 153500],
      [140, 1541, 1000, 216000],
      [177, 1594, 1, 282138],
      [14, 1647, 50, 23050],
      [51, 1050, 100, 53600],
      [88, 1103, 250, 97000],
      [125, 1156, 500, 144500],
      [162, 1209, 1000, 196000],
      [199, 1262, 1, 251138],
      [36, 1315, 50, 47350],
      [73, 1368, 100, 99900],
      [110, 1421, 250, 156250],
      [147, 1474, 500, 216500],
      [184, 1527, 1000, 281000],
      [21, 1580, 1, 33180],
    ];
    for (const [usd, rate, step, value] of cases)
      expect(usdValue(usd, rate, step), `${usd} at ${rate} to ${step}`).toBe(value);
  });

  it("suggests the fewest dollars that pay, then round notes above", () => {
    expect(dollarsFor(2500, 1310, 250)).toBe(2); // $1 is 1,250; $2 is 2,500
    expect(dollarsFor(5000, 1310, 250)).toBe(4); // $4 is 5,250 (5,240)
    expect(dollarsFor(0, 1310, 250)).toBe(0);
    expect(suggestedDollars(2500, 1310, 250)).toEqual([2, 5, 10, 20]);
    expect(suggestedDollars(30000, 1310, 250)).toEqual([23, 25, 30, 40]);
    expect(fmtUSD(1250)).toBe("$1,250");
  });

  it("takes dollars worth the total or more: the change in dinars", () => {
    const c = checkDollars(2500, 1310, 250, "5", "cash", "");
    expect(c).toMatchObject({ usd: 5, value: 6500, change: 4000, rest: 0, problem: null });
    expect(c.payments).toEqual([
      { type: "cash", currency: "USD", usd: 5, rate: 1310, received: null, amount: 2500 },
    ]);
  });

  it("takes dollars worth less than the total: they pay what they are worth, the rest another way", () => {
    const card = checkDollars(6000, 1310, 250, "2", "card", "");
    expect(card).toMatchObject({ value: 2500, rest: 3500, problem: null });
    expect(card.payments).toEqual([
      { type: "cash", currency: "USD", usd: 2, rate: 1310, received: null, amount: 2500 },
      { type: "card", amount: 3500, received: null },
    ]);
    const cash = checkDollars(6000, 1310, 250, "2", "cash", "5000");
    expect(cash).toMatchObject({ rest: 3500, restReceived: 5000, restChange: 1500, problem: null });
    expect(cash.payments?.[1]).toEqual({ type: "cash", amount: 3500, received: 5000 });
    expect(checkDollars(6000, 1310, 250, "2", "cash", "3000").problem).toBe("restShort");
    expect(checkDollars(6000, 1310, 250, "2.5", "cash", "").problem).toBe("notNumber");
    expect(checkDollars(6000, 1310, 250, "", "cash", "").problem).toBe("none");
    // Arabic and Kurdish digits are digits.
    expect(checkDollars(2500, 1310, 250, "٥", "cash", "").usd).toBe(5);
  });

  it("sends the dollars and the rate shown, and reads them back as recorded", () => {
    const sent = howPaidUsd({
      tenders: [
        { type: "cash", amount: "2500", currency: "USD", usd: 5, rate: 1310 },
        { type: "card", amount: "1000" },
      ],
    });
    expect(sent?.p_tenders).toEqual([
      { type: "cash", amount: 2500, received: null, currency: "USD", usd: 5, rate: 1310 },
      { type: "card", amount: 1000, received: null },
    ]);
    expect(
      paidPartUsd({
        type: "cash",
        amount: 2500,
        received: 6500,
        change: 4000,
        currency: "USD",
        usd: 5,
        rate: 1310,
      }),
    ).toEqual({
      type: "cash",
      amount: 2500,
      received: 6500,
      change: 4000,
      currency: "USD",
      usd: 5,
      rate: 1310,
    });
    expect(paidPartUsd({ type: "card", amount: 1000, received: null, change: null })).toEqual({
      type: "card",
      amount: 1000,
      received: null,
      change: null,
    });
    const ok = paymentsSchema.safeParse([
      { type: "cash", amount: 2500, currency: "USD", usd: 5, rate: 1310 },
    ]);
    expect(ok.success).toBe(true);
    const half = paymentsSchema.safeParse([
      { type: "cash", amount: 2500, currency: "USD", usd: 5.5, rate: 1310 },
    ]);
    expect(half.success ? null : half.error.issues[0]?.message).toBe(
      "Dollars are taken in whole dollars",
    );
  });

  it("reads the rate, the report and a close with dollars", () => {
    const fx = fxStatusFrom({
      rate: 1310,
      set_at: "2026-09-28T06:00:00Z",
      set_by: "Demo Manager",
      reason: "Market",
      age_hours: 3,
      max_age_hours: 36,
      usable: true,
      round_to: 250,
      may_set: false,
      history: [
        { rate: 1310, set_at: "2026-09-28T06:00:00Z", set_by: "Demo Manager", reason: "Market" },
      ],
    });
    expect(fx).toMatchObject({ rate: 1310, usable: true, roundTo: 250, maxAgeHours: 36 });
    expect(fx.history).toHaveLength(1);
    expect(fxStatusFrom(null)).toMatchObject({ rate: null, usable: false, roundTo: 250 });
    const r = dollarsReportFrom({
      taken: { sales: 2, usd: 7, value: 9000, paid: 5000, change: 4000 },
      held: {
        tills: [{ location_id: "l", location: "Main", usd: 5, value: 6500 }],
        safe: { usd: 1, value: 1294 },
      },
      counts: [
        { session_id: "s", session_no: 4, at: "x", location: "Main", expected: 2, counted: null },
      ],
    });
    expect(r.taken).toEqual({ sales: 2, usd: 7, value: 9000, paid: 5000, change: 4000 });
    expect(r.held.safe).toEqual({ usd: 1, value: 1294 });
    expect(r.counts[0]?.counted).toBeNull();
    const closed = countResult({
      session_no: 4,
      usd_expected: 2,
      usd_counted: 1,
      usd_variance: -1,
      usd_variance_value: -1294,
      usd_taken: 1,
      usd_taken_value: 1294,
      usd_journal_no: 1050,
    });
    expect(closed.usd).toEqual({
      expected: 2,
      counted: 1,
      variance: -1,
      varianceValue: -1294,
      taken: 1,
      takenValue: 1294,
      journalNo: 1050,
    });
    expect(countResult({ session_no: 5, usd_carried: 20 }).usdCarried).toBe(20);
    expect(countResult({ session_no: 5 }).usd).toBeNull();
    expect(drawerStateFrom({ dollars: { in_till: true, usd: null, value: null } }).dollars).toEqual(
      {
        inTill: true,
        usd: null,
        value: null,
      },
    );
  });

  it("knows the refusals that mean the till should read the rate again", () => {
    expect(
      RATE_REFUSED.test("No dollar rate is set: a manager sets today's on Sales → Dollars"),
    ).toBe(true);
    expect(
      RATE_REFUSED.test(
        "The dollar rate was set 40 hours ago: a manager sets today's before dollars are taken",
      ),
    ).toBe(true);
    expect(
      RATE_REFUSED.test("The dollar rate is now 1320, not the 1310 shown: take the payment again"),
    ).toBe(true);
    expect(RATE_REFUSED.test("The payments cannot be read")).toBe(false);
  });

  it("names the rate and an exchange on the audit trail, under cash", () => {
    const migration = readFileSync(
      join(__dirname, "../supabase/migrations/0043_foreign_cash.sql"),
      "utf8",
    );
    for (const a of ["fx.rate.set", "fx.exchange"]) {
      expect(migration).toContain(`'${a}'`);
      expect(actionLabel(a)).not.toBe(a);
      expect(
        AUDIT_GROUPS.find((g) => g.key === "cash")?.prefixes.some((p) => a.startsWith(p)),
      ).toBe(true);
    }
  });
});

describe("purchasing: orders, returns and the suppliers' credits (0044)", () => {
  const line = (over: Partial<PoLine> = {}): PoLine => ({
    lineId: "l1",
    lineNo: 1,
    itemId: "beans",
    item: "Golden beans",
    qty: 6,
    unitCode: "kg",
    unitPrice: 9000,
    amount: 54000,
    baseQty: 6000,
    baseUnit: "g",
    receivedBase: 0,
    outstandingBase: 6000,
    ...over,
  });

  it("reads an order as the database gives it, and never a status it does not know", () => {
    const o = purchaseOrderFrom({
      id: "po-1",
      po_no: 1,
      status: "sent",
      receiving: "part",
      supplier_id: "kci",
      supplier: "KCI",
      location_id: "main",
      location: "Main",
      expected_on: "2026-10-01",
      note: null,
      total: "58000",
      created_at: "2026-09-28T08:00:00Z",
      created_by: "Demo Buyer",
      approved_at: "2026-09-28T09:00:00Z",
      approved_by: "Demo Manager",
      lines: [
        {
          line_id: "l1",
          line_no: 1,
          item_id: "beans",
          item: "Golden beans",
          qty: 6,
          unit_code: "kg",
          unit_price: 9000,
          amount: 54000,
          base_qty: 6000,
          base_unit: "g",
          received_base: 4000,
          outstanding_base: 2000,
        },
      ],
      unexpected: [{ item_id: "milk", item: "Milk", base_qty: 2, base_unit: "l" }],
      deliveries: [{ receipt_id: "r1", receipt_no: 7, received_at: "2026-09-29T10:00:00Z" }],
      may_approve: "true",
    });
    expect(o.total).toBe(58000);
    expect(o.lines[0]?.outstandingBase).toBe(2000);
    expect(o.unexpected).toEqual([{ itemId: "milk", item: "Milk", baseQty: 2, baseUnit: "l" }]);
    expect(o.deliveries[0]?.receiptNo).toBe(7);
    expect(o.mayApprove).toBe(false);
    expect(purchaseOrderFrom({ status: "lost", receiving: "some" })).toMatchObject({
      status: "draft",
      receiving: "none",
      lines: [],
    });
    expect(purchaseOrdersFrom(null)).toEqual({ approveUpTo: null, orders: [] });
    expect(purchaseOrdersFrom({ approve_up_to: 250000, orders: [{}] }).approveUpTo).toBe(250000);
  });

  it("names an order's stage from its status and what has come", () => {
    expect(orderStage({ status: "approved", receiving: "none" })).toBe("approved");
    expect(orderStage({ status: "sent", receiving: "part" })).toBe("part");
    expect(orderStage({ status: "approved", receiving: "all" })).toBe("received");
    expect(orderStage({ status: "closed", receiving: "part" })).toBe("closed");
    expect(orderStage({ status: "draft", receiving: "none" })).toBe("draft");
    expect(orderStage({ status: "cancelled", receiving: "none" })).toBe("cancelled");
    expect(isOpen({ status: "sent" })).toBe(true);
    expect(isOpen({ status: "draft" })).toBe(false);
    expect(isOpen({ status: "closed" })).toBe(false);
  });

  it("says what has come in the unit each line was ordered in", () => {
    expect(inOrderUnit(line(), 4000)).toBe(4);
    expect(inOrderUnit(line({ qty: 2, baseQty: 100, unitCode: "sleeve_50" }), 50)).toBe(1);
    expect(inOrderUnit(line({ qty: 3, baseQty: 3000 }), 1234.5678)).toBe(1.235);
    expect(inOrderUnit(line({ baseQty: 0 }), 10)).toBe(0);
  });

  it("pre-fills a delivery with what is still to come, at the order's price", () => {
    const o = {
      lines: [
        line({ receivedBase: 4000, outstandingBase: 2000 }),
        line({
          lineId: "l2",
          itemId: "cups",
          qty: 2,
          unitCode: "sleeve_50",
          unitPrice: 2000,
          baseQty: 100,
          receivedBase: 100,
          outstandingBase: 0,
        }),
      ],
    };
    expect(prefillFromOrder(o)).toEqual([
      { poLineId: "l1", itemId: "beans", qty: 2, unitCode: "kg", unitPrice: 9000 },
    ]);
  });

  it("shows how a delivery line differs from its order", () => {
    const o = { lines: [line({ receivedBase: 4000, outstandingBase: 2000 })] };
    const at = (qty: number, unitPrice = 9000, unitCode = "kg", itemId = "beans") =>
      differences(o, { itemId, qty, unitCode, unitPrice });
    expect(at(2)).toEqual([]);
    expect(at(3)).toEqual([{ kind: "more", ordered: 2, coming: 3 }]);
    expect(at(1, 9500)).toEqual([
      { kind: "less", ordered: 2, coming: 1 },
      { kind: "price", ordered: 9000, now: 9500 },
    ]);
    expect(at(2, 9000, "kg", "milk")).toEqual([{ kind: "unexpected" }]);
    // In another unit than the order's, the database's check in base units is the one.
    expect(at(2500, 9, "g")).toEqual([]);
  });

  it("totals an order as the database does: each line to the dinar, half to even", () => {
    expect(
      orderTotal([
        { qty: 6, unitPrice: 9000 },
        { qty: 2, unitPrice: 2000 },
      ]),
    ).toBe(58000);
    expect(orderTotal([{ qty: 2.5, unitPrice: 1 }])).toBe(2);
    expect(orderTotal([{ qty: 3.5, unitPrice: 1 }])).toBe(4);
    expect(orderTotal([{ qty: 0.1, unitPrice: 3 }])).toBe(0);
    expect(orderTotal([])).toBe(0);
  });

  it("knows a delivery refused only to be confirmed from one refused outright", () => {
    expect(needsDeliveryConfirmation("Check the price: Golden beans at 20000 is 122% above")).toBe(
      true,
    );
    expect(
      needsDeliveryConfirmation(
        "Check the quantity: Golden beans: 2 kg ordered, 3 with this delivery",
      ),
    ).toBe(true);
    expect(needsDeliveryConfirmation("Check the price and the quantity: …")).toBe(true);
    expect(needsDeliveryConfirmation("Order 3 is not approved: it cannot be received")).toBe(false);
  });

  it("reads a supplier's statement and the purchasing report", () => {
    const st = statementFrom({
      supplier: { id: "kci", name: "KCI", contact: null, phone: "0750" },
      from: "2026-09-01",
      to: "2026-09-30",
      opening: 0,
      lines: [
        { date: "2026-09-02", kind: "bill", id: "b1", ref: "INV-1", charge: 44000, balance: 44000 },
        {
          date: "2026-09-03",
          kind: "credit",
          id: "c1",
          ref: null,
          credit: 400,
          balance: 43600,
          credit_no: 1,
          credit_kind: "goods_return",
          return_no: 1,
        },
        { date: "2026-09-04", kind: "odd", id: "x" },
      ],
      closing: 43600,
      open_credits: [{ credit_id: "c1", credit_no: 1, kind: "refund", amount: 400, left: 0 }],
    });
    expect(st.lines.map((l) => [l.kind, l.creditKind, l.returnNo])).toEqual([
      ["bill", null, null],
      ["credit", "goods_return", 1],
      ["bill", null, null],
    ]);
    expect(st.closing).toBe(43600);
    expect(st.openCredits[0]?.kind).toBe("other");
    const r = purchasingReportFrom({
      orders: [{ po_id: "p", po_no: 1, status: "closed", receiving: "part", ordered: 270000 }],
      returns: [{ return_id: "x", return_no: 1, against: "delivery" }, { against: "?" }],
      credits: [{ credit_id: "c", credit_no: 1, kind: "price", amount: 400, set_against: 400 }],
      totals: { returned: 3400, credited: 3400, credits_left: 0 },
    });
    expect(r.orders[0]).toMatchObject({ status: "closed", receiving: "part", ordered: 270000 });
    expect(r.returns.map((x) => x.against)).toEqual(["delivery", "account"]);
    expect(r.credits[0]).toMatchObject({ kind: "price", setAgainst: 400, left: 0 });
    expect(r.totals).toEqual({ returned: 3400, credited: 3400, creditsLeft: 0 });
    expect(purchasingReportFrom(null).orders).toEqual([]);
  });

  it("has every stage and kind of credit in Arabic and Kurdish", () => {
    expect(Object.keys(STAGE_LABEL)).toHaveLength(7);
    expect(Object.keys(CREDIT_KIND_LABEL)).toEqual(["goods_return", "price", "other"]);
    for (const locale of ["ar", "ckb"] as const) {
      const words = builtInWords(locale);
      expect(
        PURCHASING_PHRASES.filter((p) => !words[p]),
        locale,
      ).toEqual([]);
    }
  });

  it("names each purchasing action on the audit trail, under suppliers and deliveries", () => {
    const migration = readFileSync(
      join(__dirname, "../supabase/migrations/0044_purchasing.sql"),
      "utf8",
    );
    for (const a of [
      "purchase.order.create",
      "purchase.order.change",
      "purchase.order.approve",
      "purchase.order.send",
      "purchase.order.close",
      "purchase.order.cancel",
      "purchase.quantity_confirmed",
      "purchase.return",
      "purchase.credit",
      "purchase.credit.note",
      "purchase.credit.allocate",
    ]) {
      expect(migration).toContain(`'${a}'`);
      expect(actionLabel(a)).not.toBe(a);
      expect(
        AUDIT_GROUPS.find((g) => g.key === "suppliers")?.prefixes.some((p) => a.startsWith(p)),
      ).toBe(true);
    }
    const none = new Map<string, string>();
    expect(subjectOf("purchase_order", "x", null, { po_no: 3 }, none)).toBe("Purchase order 3");
    expect(subjectOf("supplier_return", "x", null, { return_no: 1 }, none)).toBe("Return 1");
    expect(subjectOf("supplier_credit", "x", null, { credit_no: 2 }, none)).toBe("Credit 2");
  });

  it("shows a return's and a credit's words on the trail, and a status as before", () => {
    const none = new Map<string, string>();
    expect(
      describeChanges(null, { credit_kind: "price", against: "account", credit_no: 2 }, none),
    ).toEqual([
      { field: "For", before: "", after: "A lower price" },
      { field: "Owed back", before: "", after: "On the account" },
      { field: "Credit note", before: "", after: "2" },
    ]);
    expect(describeChanges({ status: "approved" }, { status: "draft" }, none)).toEqual([
      { field: "Status", before: "approved", after: "draft" },
    ]);
  });

  it("lets the managers approve orders, up to the limit a rule sets", () => {
    expect(RULE_ORDER).toContain("po_approve_up_to");
    for (const r of ["owner", "general_manager", "branch_manager"] as Role[])
      expect(ROLE_PERMISSIONS[r].has("purchase.approve"), r).toBe(true);
    for (const r of ["cashier", "purchasing"] as Role[])
      expect(ROLE_PERMISSIONS[r].has("purchase.approve"), r).toBe(false);
  });
});

describe("the buying list (0045)", () => {
  // Milk as buying_list() gives it in tests/sql/buying_list.test.sql: 2,000 ml
  // on hand, 1,000 a day for 25 days, the dairy two days away, bought by the
  // carton; and the usual supplier's terms beside the dairy's.
  const payload = {
    location_id: "loc",
    location: "Main Branch",
    as_of: "2026-09-28",
    window_days: 28,
    lead_time: 1,
    items: [
      {
        item_id: "milk",
        item: "List milk",
        base_unit: "ml",
        item_type: "ingredient",
        status: "order",
        on_hand: 2000,
        on_order: 0,
        in_draft: 0,
        position: 2000,
        orders: [],
        history_days: 25,
        days: 25,
        used: 25000,
        daily_use: 1000,
        lead_time: 2,
        lead_from: "supplier",
        reorder_level: 3000,
        reorder_from: "use",
        safety_stock: null,
        target_level: 10000,
        target_from: "week",
        supplier_id: "dairy",
        supplier: "Sulaymaniyah Dairy Co.",
        supplier_from: "last_delivery",
        pack_unit: "carton_1l",
        pack_factor: 1000,
        packs: 8,
        qty_base: 8000,
        price: 1500,
        price_from: "delivery",
        price_on: "2026-09-28",
        choices: [
          {
            supplier_id: "dairy",
            supplier: "Sulaymaniyah Dairy Co.",
            usual: false,
            lead_time: 2,
            pack_unit: "carton_1l",
            pack_factor: 1000,
            price: 1500,
            price_from: "delivery",
            price_on: "2026-09-28",
          },
          {
            supplier_id: "city",
            supplier: "City Packaging Supplies",
            usual: false,
            lead_time: null,
            pack_unit: "ml",
            pack_factor: 1,
            price: 1.4,
            price_from: "agreed",
            price_on: "2026-09-20",
          },
        ],
      },
      {
        item_id: "sugar",
        item: "List sugar",
        base_unit: "g",
        item_type: "ingredient",
        status: "no_history",
        on_hand: 500,
        on_order: 0,
        in_draft: 0,
        position: 500,
        history_days: 5,
        days: 5,
        used: 2500,
        daily_use: null,
        lead_time: 1,
        lead_from: "cafe",
        reorder_level: null,
        target_level: null,
        supplier_id: null,
        pack_unit: "g",
        pack_factor: 1,
        packs: 0,
        qty_base: 0,
        price: null,
        choices: [],
      },
    ],
  };
  const list = buyingListFrom(payload);
  const milk = list.items[0]!;
  const sugar = list.items[1]!;

  it("reads the list as the database gives it", () => {
    expect(list).toMatchObject({ location: "Main Branch", windowDays: 28, leadTime: 1 });
    expect(milk).toMatchObject({
      status: "order",
      dailyUse: 1000,
      reorderFrom: "use",
      targetFrom: "week",
      supplierFrom: "last_delivery",
      packs: 8,
      qtyBase: 8000,
      priceFrom: "delivery",
    });
    expect(milk.choices.map((c) => c.supplier)).toEqual([
      "Sulaymaniyah Dairy Co.",
      "City Packaging Supplies",
    ]);
    expect(sugar).toMatchObject({ status: "no_history", supplierId: null, reorderLevel: null });
    expect(buyingListFrom(null).items).toEqual([]);
  });

  it("says why, with the numbers", () => {
    expect(reasonsOf(milk, undefined, (c) => (c === "carton_1l" ? "Carton of 1 L" : c))).toEqual([
      "2,000 ml on hand.",
      "About 1,000 ml a day over the last 25 days; a delivery takes 2 day(s), and a day more: 3,000 ml is its reorder level.",
      "Below it: to order.",
      "Ordered up to the reorder level and a week of use: 10,000 ml.",
      "8 × Carton of 1 L (8,000 ml), rounded up to whole packs.",
    ]);
    expect(sourceOf(milk)).toEqual([
      "The supplier of its last delivery.",
      "1,500 IQD a pack, as delivered 2026-09-28.",
    ]);
    expect(reasonsOf(sugar)).toEqual([
      "Only 5 day(s) of history: 7 are needed to judge its use by.",
      "Set a reorder level on the item, or add it to an order yourself.",
    ]);
    // New today: not "only 0 days".
    expect(reasonsOf({ ...sugar, historyDays: 0 })[0]).toBe(
      "First in stock here today: 7 days of history are needed to judge its use by.",
    );
    expect(sourceOf(sugar)).toEqual(["No supplier yet: choose one.", "No price yet: enter one."]);
    const drafted = { ...milk, status: "enough" as const, inDraft: 7000, position: 9000 };
    expect(reasonsOf(drafted)[0]).toBe(
      "2,000 ml on hand, 0 ml on order and 7,000 ml in draft orders: 9,000 ml in all.",
    );
    expect(reasonsOf(drafted)[2]).toBe("At or above it: nothing to order yet.");
    const own = {
      ...milk,
      reorderFrom: "item" as const,
      reorderLevel: 2500,
      targetFrom: "par" as const,
    };
    expect(reasonsOf(own).slice(1, 3)).toEqual([
      "Below its reorder level, set on the item: 2,500 ml.",
      "Ordered up to its par level, 10,000 ml.",
    ]);
  });

  it("rounds what is needed up to whole packs, one at least", () => {
    expect(needOf(milk)).toBe(8000);
    expect(needOf({ targetLevel: 100, position: 150 })).toBe(0);
    expect(needOf({ targetLevel: null, position: 0 })).toBe(0);
    expect(packsFor(7500, 1000)).toBe(8);
    expect(packsFor(8000, 1000)).toBe(8);
    expect(packsFor(0, 1000)).toBe(1);
    expect(packsFor(0.3, 0.1)).toBe(3);
    expect(packsIn(milk, 1)).toBe(8000);
    expect(packsIn(sugar, 1000)).toBe(1);
  });

  it("moves a line to another supplier's pack and price, and to another pack", () => {
    const d = draftOf(milk);
    expect(d).toEqual({
      itemId: "milk",
      include: true,
      qty: "8",
      unit: "carton_1l",
      price: "1500",
      supplierId: "dairy",
      usual: false,
    });
    expect(draftOf(sugar)).toMatchObject({ include: false, qty: "1", price: "", supplierId: "" });
    expect(withSupplier(milk, d, "city")).toMatchObject({
      supplierId: "city",
      unit: "ml",
      qty: "8000",
      price: "1.4",
    });
    // A supplier with no terms of its own: the line stays, its price to be checked.
    expect(withSupplier(milk, d, "kci")).toEqual({ ...d, supplierId: "kci" });
    const units = [
      { code: "ml", factor: 1 },
      { code: "carton_1l", factor: 1000 },
    ];
    expect(inPack(milk, d, "ml", units)).toMatchObject({ unit: "ml", qty: "8000", price: "1.5" });
    // Added by hand: as much as before, in whole packs of the new size.
    const byHand = { ...draftOf(sugar), unit: "ml", qty: "2500", price: "2" };
    expect(inPack(sugar, byHand, "carton_1l", units)).toMatchObject({
      unit: "carton_1l",
      qty: "3",
      price: "2000",
    });
  });

  it("groups the lines ticked by supplier, those with none last", () => {
    const names = new Map([
      ["dairy", "Sulaymaniyah Dairy Co."],
      ["city", "City Packaging Supplies"],
    ]);
    const groups = bySupplier(
      [
        { supplierId: "dairy", qty: 7, unitPrice: 1500 },
        { supplierId: "", qty: 2, unitPrice: 5000 },
        { supplierId: "city", qty: 2, unitPrice: 5000 },
        { supplierId: "dairy", qty: 1, unitPrice: 250 },
      ],
      names,
    );
    expect(groups.map((g) => [g.supplier, g.lines.length, g.total])).toEqual([
      ["City Packaging Supplies", 1, 10000],
      ["Sulaymaniyah Dairy Co.", 2, 10750],
      [null, 1, 10000],
    ]);
  });

  it("starts the screen again when the list changes under it", () => {
    const after = buyingListFrom({
      ...payload,
      items: [{ ...payload.items[0], status: "enough", in_draft: 8000, position: 10000, packs: 0 }],
    });
    expect(listStamp(after)).not.toBe(listStamp(list));
    expect(listStamp(buyingListFrom(payload))).toBe(listStamp(list));
  });

  it("has every status in Arabic and Kurdish", () => {
    expect(Object.keys(STATUS_LABEL)).toEqual(["order", "enough", "no_history", "not_used"]);
    for (const locale of ["ar", "ckb"] as const) {
      const words = builtInWords(locale);
      expect(
        BUYING_PHRASES.filter((p) => !words[p]),
        locale,
      ).toEqual([]);
    }
  });

  it("names an item's supplier set or removed on the audit trail, under stock items", () => {
    const migration = readFileSync(
      join(__dirname, "../supabase/migrations/0045_buying_list.sql"),
      "utf8",
    );
    for (const a of ["item.supplier.set", "item.supplier.remove"]) {
      expect(migration).toContain(`'${a}'`);
      expect(actionLabel(a)).not.toBe(a);
      expect(
        AUDIT_GROUPS.find((g) => g.key === "items")?.prefixes.some((p) => a.startsWith(p)),
      ).toBe(true);
    }
    const KCI = "5a000000-0000-4000-8000-000000000001";
    const CITY = "5a000000-0000-4000-8000-000000000002";
    const names = new Map([
      [KCI, "Kurdistan Coffee Imports"],
      [CITY, "City Packaging Supplies"],
    ]);
    expect(
      describeChanges(
        null,
        {
          supplier: CITY,
          pack_unit: "sleeve_50",
          last_price: 2000,
          usual: true,
          instead_of: KCI,
        },
        names,
      ),
    ).toEqual([
      { field: "Supplier", before: "", after: "City Packaging Supplies" },
      { field: "Pack", before: "", after: "sleeve_50" },
      { field: "Price of a pack", before: "", after: "2,000" },
      { field: "The usual supplier", before: "", after: "yes" },
      { field: "In place of", before: "", after: "Kurdistan Coffee Imports" },
    ]);
  });
});

describe("batches, their use-by dates and lots, and the day's plan (0046, release U)", () => {
  it("reads a time on the café's clock, and gives it back as the form shows it", () => {
    // Baghdad is three hours ahead of UTC all year.
    expect(localTimeToIso("2026-09-28T14:30", "Asia/Baghdad")).toBe("2026-09-28T11:30:00.000Z");
    expect(localTimeToIso("2026-09-28T01:15", "Asia/Baghdad")).toBe("2026-09-27T22:15:00.000Z");
    expect(isoToLocalTime("2026-09-27T22:15:00.000Z", "Asia/Baghdad")).toBe("2026-09-28T01:15");
    expect(localTimeToIso("", "Asia/Baghdad")).toBeNull();
    expect(localTimeToIso("2026-09-28", "Asia/Baghdad")).toBeNull();
    expect(isoToLocalTime("not a time", "Asia/Baghdad")).toBe("");
  });

  it("takes a shelf life in days or hours, an hour to a year", () => {
    expect(keepsHours("3", "days")).toBe(72);
    expect(keepsHours("36", "hours")).toBe(36);
    expect(keepsHours(" ", "days")).toBeNull();
    expect(keepsHours("0", "hours")).toBe("bad");
    expect(keepsHours("1.5", "hours")).toBe("bad");
    expect(keepsHours("366", "days")).toBe("bad");
    expect(keepsHours("365", "days")).toBe(8760);
    expect(keepsFields(72)).toEqual({ qty: "3", unit: "days" });
    expect(keepsFields(36)).toEqual({ qty: "36", unit: "hours" });
    expect(keepsFields(null)).toEqual({ qty: "", unit: "days" });
    expect(keepsLabel(48)).toEqual({ text: "keeps {n} day(s)", vars: { n: 2 } });
    expect(keepsLabel(5)).toEqual({ text: "keeps {n} hour(s)", vars: { n: 5 } });
    expect(keepsLabel(null)).toBeNull();
  });

  it("accounts for a batch: made = sold + used + lost ± counts + left", () => {
    // Batch 3 of the SQL test: 1 kg made, 100 g sold, 400 g lost, 500 g missing on a count.
    const three = storyFrom({ made: 1000, sold: 100, lost: 400, counted: -500, left: 0 })!;
    expect(storyAddsUp(three)).toBe(true);
    expect(storyAddsUp({ ...three, left: 50 })).toBe(false);
    const two = storyFrom({ made: 4800, sold: 4500, used: 0, lost: 300, left: 0 })!;
    expect(storyAddsUp(two)).toBe(true);
    expect(storyFrom(null)).toBeNull();
  });

  it("names each movement of a lot by what it was and which way it went", () => {
    expect(lotMovementLabel("sold", -200)).toBe("Sale");
    expect(lotMovementLabel("sold", 300)).toBe("Back from a sale (void or refund)");
    expect(lotMovementLabel("made", -5000)).toBe("Batch cancelled");
    expect(lotMovementLabel("wasted", 200)).toBe("Loss taken back");
    expect(lotMovementLabel("counted", -500)).toBe("Missing on a count");
    expect(lotMovementLabel("counted", 200)).toBe("Found on a count");
    expect(lotMovementLabel("revalued", 1)).toBe("Corrected");
  });

  it("reads the plan, the lots, a batch and the report as the database gives them", () => {
    const plan = planFrom({
      day: "2026-09-28",
      weekday: 1,
      location: "Main Branch",
      recipes: [
        {
          recipe_id: "r",
          recipe: "Chocolate gelato",
          item_id: "i",
          item: "Chocolate gelato",
          base_unit: "g",
          batch_yield: 4000,
          yield_unit: "kg",
          status: "make",
          history_days: 43,
          weeks: 6,
          days: [{ day: "2026-09-21", used: 1000 }],
          demand: 2000,
          on_hand: 5000,
          due: 4000,
          good: 1000,
          to_make: 1000,
          batches: 1,
          makes: 4000,
          ingredients: [],
        },
        { recipe_id: "v", recipe: "Vanilla gelato", status: "no_history", history_days: 0 },
        { recipe_id: "x", recipe: "Odd", status: "something else" },
      ],
      ingredients: [
        { item_id: "c", item: "Cocoa", base_unit: "g", needed: 500, on_hand: 300, short: 200 },
      ],
    });
    expect(plan.recipes.map((r) => r.status)).toEqual(["make", "no_history", "no_history"]);
    expect(plan.recipes[0]).toMatchObject({ weeks: 6, demand: 2000, good: 1000, batches: 1 });
    expect(plan.recipes[1]).toMatchObject({ demand: null, weeks: null, historyDays: 0 });
    expect(plan.ingredients[0]).toMatchObject({ item: "Cocoa", short: 200 });

    const lots = lotsFrom([
      {
        lot_id: "l",
        lot: "B3",
        item_id: "i",
        item: "Vanilla",
        base_unit: "g",
        batch_id: "b",
        batch_no: 3,
        use_by: "2026-09-28T08:00:00Z",
        left: 100,
        status: "expired",
      },
    ]);
    expect(lots[0]).toMatchObject({ batchNo: 3, left: 100, status: "expired" });

    const b = reconciliationFrom({
      batch_id: "b",
      batch_no: 3,
      status: "completed",
      recipe: "Vanilla",
      item: "Vanilla",
      base_unit: "g",
      entered_unit: null,
      actual: 1000,
      planned: 5000,
      made_at: "t",
      late_reason: "Made this morning",
      story: { made: 1000, sold: 100, lost: 400, counted: -500, left: 0 },
      movements: [{ at: "t", kind: "wasted", qty: -400, reason: "Past its use-by" }],
    });
    expect(b).toMatchObject({ batchNo: 3, enteredUnit: "g", lateReason: "Made this morning" });
    expect(b.story && storyAddsUp(b.story)).toBe(true);
    expect(b.movements[0]).toMatchObject({ kind: "wasted", qty: -400, by: null });
    expect(reconciliationFrom({ batch_no: 1 }).story).toBeNull();

    const report = productionReportFrom({
      batches: [
        { batch_id: "b", batch_no: 2, yield_pct: 96.0, planned: 5000, actual: 4800, story: null },
      ],
    });
    expect(report[0]).toMatchObject({ batchNo: 2, yieldPct: 96, story: null });
  });

  it("has every word Production gives a batch, a lot and the plan in Arabic and Kurdish", () => {
    for (const locale of ["ar", "ckb"] as const) {
      const words = builtInWords(locale);
      expect(
        PRODUCTION_PHRASES.filter((p) => !words[p]),
        locale,
      ).toEqual([]);
    }
  });

  it("names a batch's use-by changed on the audit trail, under stock", () => {
    const migration = readFileSync(
      join(__dirname, "../supabase/migrations/0046_production_lots.sql"),
      "utf8",
    );
    expect(migration).toContain("'production.use_by'");
    expect(actionLabel("production.use_by")).toBe("Batch use-by changed");
    expect(
      AUDIT_GROUPS.find((g) => g.key === "stock")?.prefixes.some((p) =>
        "production.use_by".startsWith(p),
      ),
    ).toBe(true);
    expect(
      describeChanges({ keeps_hours: 72 }, { keeps_hours: null }, new Map()).map((c) => c.field),
    ).toEqual(["Keeps (hours)"]);
  });
});

describe("kinds of loss, giveaways at the till and the loss report (0048, release V)", () => {
  const migration = readFileSync(join(__dirname, "../supabase/migrations/0048_losses.sql"), "utf8");

  it("charges each kind of loss to the account the database charges it to", () => {
    // loss_account in 0048, kind by kind.
    const accountFor = (kind: string) => {
      const body = migration.slice(migration.indexOf("function loss_account("));
      for (const [code, kinds] of [
        ["5310", ["production_waste", "preparation_waste"]],
        ["6110", ["staff_consumption"]],
        ["6610", ["complimentary"]],
        ["6620", ["sampling"]],
      ] as const)
        if ((kinds as readonly string[]).includes(kind)) {
          expect(body).toContain(`then '${code}'`);
          return code;
        }
      return "5300";
    };
    for (const k of LOSS_KINDS) expect(k.account, k.kind).toBe(accountFor(k.kind));
    // Every account a loss is charged to is in the chart the database sets up, by that name.
    for (const [code, name] of Object.entries(LOSS_ACCOUNT_NAME))
      if (code !== "5300") expect(migration).toContain(`('${code}','${name}'`);
    expect(migration).toContain("('5300','Waste & spoilage'");
  });

  it("names each kind as the stock card does, and explains it", () => {
    for (const k of LOSS_KINDS) {
      expect(movementLabel(k.kind)).toBe(k.label);
      expect(k.explain.length).toBeGreaterThan(10);
    }
    expect(lossKind("production_waste")?.account).toBe("5310");
    expect(lossKind("sale_consumption")).toBeNull();
    // The till gives away three of them, under their own names.
    expect(GIVEAWAY_KINDS.map((g) => g.kind)).toEqual([
      "staff_consumption",
      "complimentary",
      "sampling",
    ]);
    expect(giveawayLabel("complimentary")).toBe("On the house");
    expect(giveawayLabel("something")).toBe("something");
  });

  it("knows when the database asks for a manager, and why", () => {
    expect(
      NEEDS_APPROVAL.test(
        "This loss needs a manager's approval: ask one to approve it now, or save it to wait for their approval",
      ),
    ).toBe(true);
    expect(
      NEEDS_STOCK_APPROVAL.test(
        "Only 190 g of Golden beans is in stock: a manager approves using more than that",
      ),
    ).toBe(true);
    expect(NEEDS_APPROVAL.test("Say why the stock was lost")).toBe(false);
  });

  it("reads the losses waiting, an item's and a product's", () => {
    const [item, product] = lossesWaitingFrom([
      {
        movement_id: "m1",
        at: "2026-09-28T10:00:00Z",
        item_id: "i1",
        item: "Milk",
        kind: "spoilage",
        qty: "150",
        unit: "ml",
        value: "225",
        reason: "Left out",
        recorded_by_id: "u1",
        recorded_by: "Sara",
        loss_id: "l1",
        account: "5300",
        batch_no: null,
      },
      {
        movement_id: "m2",
        at: "2026-09-28T10:05:00Z",
        item_id: null,
        item: "Latte",
        kind: "damaged",
        qty: 2,
        unit: null,
        value: null,
        reason: null,
        recorded_by_id: null,
        recorded_by: null,
        loss_id: "l2",
        account: "5300",
        batch_no: 4,
      },
    ]);
    expect(item).toMatchObject({ lossId: "l1", qty: 150, unit: "ml", value: 225, batchNo: null });
    expect(product).toMatchObject({ itemId: null, unit: null, value: null, batchNo: 4 });
  });

  it("reads the loss report, and shares out what each kind lost", () => {
    const r = lossReportFrom({
      from: "2026-09-01",
      to: "2026-09-28",
      total: {
        value: 6140,
        count: 20,
        pending_count: 0,
        pending_value: 0,
        reversed_count: 1,
        reversed_value: 960,
      },
      by_kind: [
        {
          kind: "damaged",
          account: "5300",
          account_name: "Waste & spoilage",
          count: 4,
          value: 2150,
        },
      ],
      by_item: [{ item_id: "i", item: "Beans", unit: "g", qty: 250, value: 2500, count: 7 }],
      by_person: [{ person_id: null, person: null, count: 1, value: 100 }],
      by_day: [{ day: "2026-09-28", count: 20, value: 6140 }],
      giveaways: [{ kind: "staff_consumption", count: 2, value: 1000 }],
      losses: [
        {
          loss_id: "l",
          movement_id: "m",
          at: "2026-09-28T10:00:00Z",
          kind: "sampling",
          account: "6620",
          value: 215,
          reason: "Tasting",
          person: "Demo Cashier",
          approved_by: null,
          pending: false,
          reversed: false,
          at_till: true,
          turn_no: 3,
          what: [
            { name: "Espresso", size: null, qty: 1, unit: null, batch_no: null, addons: ["Syrup"] },
          ],
        },
      ],
    });
    expect(r.total).toEqual({
      value: 6140,
      count: 20,
      pendingCount: 0,
      pendingValue: 0,
      reversedCount: 1,
      reversedValue: 960,
    });
    expect(r.byKind[0]).toMatchObject({ kind: "damaged", account: "5300", count: 4, value: 2150 });
    expect(r.losses[0]).toMatchObject({
      atTill: true,
      turnNo: 3,
      what: [{ addons: ["Syrup"], unit: null }],
    });
    expect(kindShare(2150, 6140)).toBe(35);
    expect(kindShare(0, 0)).toBe(0);
    expect(lossReportFrom(null)).toMatchObject({ losses: [], byKind: [], total: { count: 0 } });
  });

  it("has every word of a loss, its account and a giveaway in Arabic and Kurdish", () => {
    for (const locale of ["ar", "ckb"] as const) {
      const words = builtInWords(locale);
      expect(
        LOSS_PHRASES.filter((p) => !words[p]),
        locale,
      ).toEqual([]);
    }
  });

  it("names a loss and a giveaway on the audit trail", () => {
    expect(migration).toContain("'inventory.loss', 'stock_loss'");
    expect(migration).toContain("'sale.giveaway', 'stock_loss'");
    expect(actionLabel("inventory.loss")).toBe("Loss recorded");
    expect(actionLabel("sale.giveaway")).toBe("Given away at the till");
    expect(auditGroup("stock")?.prefixes.some((p) => "inventory.loss".startsWith(p))).toBe(true);
    expect(auditGroup("sales")?.prefixes.some((p) => "sale.giveaway".startsWith(p))).toBe(true);
    expect(subjectOf("stock_loss", "l", null, { what: "Loss latte" }, new Map())).toBe(
      "Loss latte",
    );
    expect(subjectOf("stock_loss", "l", null, { item: "i1" }, new Map([["i1", "Milk"]]))).toBe(
      "Milk",
    );
    expect(subjectOf("stock_loss", "l", null, {}, new Map())).toBe("A loss");
    expect(showValue("preparation_waste", "movement", new Map())).toBe("Preparation waste");
  });
});

describe("staff, their hours and their pay (0049, release W)", () => {
  const migration = readFileSync(join(__dirname, "../supabase/migrations/0049_staff.sql"), "utf8");

  it("reads hours as they are typed, in any digits", () => {
    expect(typedTime("8")).toBe("08:00");
    expect(typedTime("8:30")).toBe("08:30");
    expect(typedTime("0830")).toBe("08:30");
    expect(typedTime("٨:٣٠")).toBe("08:30");
    expect(typedTime("24")).toBeNull();
    expect(typedTime("8:60")).toBeNull();
    expect(typedTime("eight")).toBeNull();
    expect(typedHours("08:00-16:00")).toEqual({ starts: "08:00", ends: "16:00" });
    expect(typedHours("8 to 16")).toEqual({ starts: "08:00", ends: "16:00" });
    // Ending before it starts: it ends the next day, as the database reads it.
    expect(typedHours("22:00 – 02:00")).toEqual({ starts: "22:00", ends: "02:00" });
    expect(typedHours("16-16")).toBeNull();
    expect(typedHours("8")).toBeNull();
  });

  it("starts the café's week on a Saturday", () => {
    expect(weekStart("2026-09-28")).toBe("2026-09-26"); // a Monday
    expect(weekStart("2026-09-26")).toBe("2026-09-26"); // the Saturday itself
    expect(weekStart("2026-10-02")).toBe("2026-09-26"); // the Friday after
    expect(weekDays("2026-09-30")).toEqual([
      "2026-09-26",
      "2026-09-27",
      "2026-09-28",
      "2026-09-29",
      "2026-09-30",
      "2026-10-01",
      "2026-10-02",
    ]);
  });

  it("shows hours, months and the café's clock as the screens do", () => {
    expect(splitMinutes(135)).toEqual({ h: 2, m: 15 });
    expect(splitMinutes(-5)).toEqual({ h: 0, m: 0 });
    expect(monthText("2026-09-01")).toBe("2026-09");
    expect(clockTime("2026-09-28T05:00:00Z", "Asia/Baghdad")).toBe("08:00");
    expect(clockTime(null, "Asia/Baghdad")).toBe("");
    const rana = { hiredOn: "2026-09-01", leftOn: "2026-09-30" };
    expect(worksOn(rana, "2026-08-31")).toBe(false);
    expect(worksOn(rana, "2026-09-01")).toBe(true);
    expect(worksOn(rana, "2026-09-30")).toBe(true);
    expect(worksOn(rana, "2026-10-01")).toBe(false);
    expect(worksOn({ hiredOn: "2026-09-01", leftOn: null }, "2030-01-01")).toBe(true);
  });

  it("gives the pay only to those who see payroll", () => {
    const [withPay, withoutPay] = staffFrom([
      {
        id: "e1",
        name: "Rana",
        location_id: "l1",
        location: "Main",
        hired_on: "2026-09-01",
        has_pin: true,
        in_since: "2026-09-28T05:00:00Z",
        pay_set: true,
        pay_basis: "monthly",
        rate: "600000",
        standard_hours: 8,
        overtime_percent: null,
        advance_owed: 50000,
      },
      {
        id: "e2",
        name: "Omar",
        location_id: "l1",
        location: "Main",
        hired_on: "2026-09-01",
        pay_set: false,
      },
    ]);
    expect(withPay).toMatchObject({
      name: "Rana",
      hasPin: true,
      inSince: "2026-09-28T05:00:00Z",
      pay: {
        basis: "monthly",
        rate: 600000,
        standardHours: 8,
        overtimePercent: null,
        advanceOwed: 50000,
      },
    });
    expect(withoutPay).toMatchObject({ name: "Omar", hasPin: false, paySet: false, pay: null });
    expect(staffFrom(null)).toEqual([]);
  });

  it("adds up a payroll: what is owed is what is to be paid less what was paid", () => {
    const run = payrollDetailFrom({
      id: "r",
      run_no: 3,
      month: "2026-08-01",
      status: "approved",
      current: null,
      month_over: true,
      lines: [
        {
          id: "a",
          name: "Rana",
          pay_basis: "monthly",
          rate: 600000,
          gross: 650000,
          net: 600000,
          advance_recovered: 50000,
          paid: 600000,
        },
        {
          id: "b",
          name: "Omar",
          pay_basis: "hourly",
          rate: 3000,
          gross: 240000,
          net: 240000,
          advance_recovered: 0,
          paid: 0,
        },
        { id: "c", name: "Sara", pay_basis: "bogus", rate: null, gross: 0, net: 0, paid: 0 },
      ],
      approvals: [
        {
          approved_at: "2026-09-01T09:00:00Z",
          approved_by: "Demo Owner",
          net: 840000,
          journal_no: 41,
        },
      ],
      payments: [
        {
          id: "p",
          paid_from: "bank",
          amount: 600000,
          paid_on: "2026-09-01",
          people: [{ employee_id: "e1", name: "Rana", amount: 600000 }],
        },
      ],
    });
    expect(run).toMatchObject({ runNo: 3, status: "approved", current: null, monthOver: true });
    expect(run.lines.map((l) => l.payBasis)).toEqual(["monthly", "hourly", null]);
    expect(run.approvals[0]).toMatchObject({
      approvedBy: "Demo Owner",
      net: 840000,
      journalNo: 41,
    });
    expect(run.payments[0]?.people).toEqual([{ employeeId: "e1", name: "Rana", amount: 600000 }]);
    expect(payrollTotals(run.lines)).toEqual({
      gross: 890000,
      net: 840000,
      recovered: 50000,
      paid: 600000,
      owed: 240000,
    });
    // A draft says whether it is still what the hours and the pay say.
    expect(payrollDetailFrom({ status: "draft", current: false }).current).toBe(false);
    expect(payrollDetailFrom({ status: "draft", current: true }).current).toBe(true);
  });

  it("reads the till's answer to a clock-in, done or refused", () => {
    expect(
      clockAnswerFrom({
        ok: true,
        name: "Rana",
        clock_in: "2026-09-28T05:10:00Z",
        late_minutes: 10,
      }),
    ).toMatchObject({ ok: true, error: null, name: "Rana", lateMinutes: 10, earlyMinutes: null });
    expect(clockAnswerFrom({ ok: false, error: "That PIN is not right" })).toMatchObject({
      ok: false,
      error: "That PIN is not right",
    });
    expect(clockAnswerFrom(null)).toMatchObject({ ok: false, error: null });
  });

  it("reads the advances, and the hours' report with what staff cost only for payroll", () => {
    const a = advancesFrom({
      advances: [
        {
          id: "x",
          employee_id: "e1",
          name: "Rana",
          amount: "50000",
          paid_from: "safe",
          reason: "Rent",
        },
      ],
      owed: [{ employee_id: "e1", name: "Rana", owed: 50000 }],
    });
    expect(a.advances[0]).toMatchObject({ amount: 50000, paidFrom: "safe", cancelledAt: null });
    expect(a.owed).toEqual([{ employeeId: "e1", name: "Rana", owed: 50000 }]);
    const people = [
      { employee_id: "e1", name: "Rana", days_worked: 20, minutes: 9600, times_late: 2 },
    ];
    expect(staffReportFrom({ people, labour: null }).labour).toBeNull();
    expect(
      staffReportFrom({
        people,
        labour: [{ month: "2026-09-01", cost: 800000, sales: 4000000, percent: 20 }],
      }).labour,
    ).toEqual([{ month: "2026-09-01", cost: 800000, sales: 4000000, percent: 20 }]);
    expect(staffReportFrom({ people }).people[0]).toMatchObject({
      daysWorked: 20,
      minutes: 9600,
      timesLate: 2,
    });
  });

  it("has every word of the staff screens in Arabic and Kurdish", () => {
    for (const locale of ["ar", "ckb"] as const) {
      const words = builtInWords(locale);
      expect(
        STAFF_PHRASES.filter((p) => !words[p]),
        locale,
      ).toEqual([]);
    }
  });

  it("reads the staff rules as the database checks them", () => {
    const body = migration.slice(migration.indexOf("create or replace function rule_definitions("));
    const json = body.match(/select '(\{[\s\S]*?\})'::jsonb/)?.[1] ?? "{}";
    const parsed = parseBusinessRules({
      definitions: JSON.parse(json.replace(/''/g, "'")),
      rows: [],
      history: [],
    });
    const def = (k: string) => parsed.definitions.find((d) => d.key === k)!;
    expect(def("late_after_minutes").kind).toBe("minutes");
    expect(def("payday").kind).toBe("day");
    expect(def("clocked_in_alert_hours").kind).toBe("hours");
    expect(def("overtime_percent").kind).toBe("percent");
    expect(typedRuleValue(def("late_after_minutes"), "10")).toEqual({ ok: true, value: 10 });
    expect(typedRuleValue(def("late_after_minutes"), "121").ok).toBe(false);
    expect(typedRuleValue(def("payday"), "29").ok).toBe(false);
    expect(typedRuleValue(def("payday"), "1.5")).toEqual({
      ok: false,
      error: "Enter a whole number",
    });
    expect(typedRuleValue(def("overtime_percent"), "99").ok).toBe(false);
    expect(typedRuleValue(def("overtime_percent"), "175")).toEqual({ ok: true, value: 175 });
  });

  it("names every staff and payroll change on the audit trail", () => {
    const actions = [
      ...new Set(
        [...migration.matchAll(/audit_event\(v_business, '([a-z_.]+)'/g)].map((m) => m[1]!),
      ),
    ].filter((a) => /^(staff|attendance|payroll)\./.test(a));
    expect(actions.length).toBe(17);
    for (const a of actions) {
      expect(actionLabel(a), a).not.toBe(a);
      expect(
        auditGroup("staff")?.prefixes.some((p) => a.startsWith(p)),
        a,
      ).toBe(true);
    }
    expect(fieldLabel("pay_rate")).toBe("Pay");
    expect(fieldLabel("job_title")).toBe("Job");
    expect(showValue("monthly", "pay_basis", new Map())).toBe("By the month");
    expect(subjectOf("employee", "e", null, { name: "Rana" }, new Map())).toBe("Rana");
    expect(subjectOf("payroll_run", "r", null, { run_no: 3, month: "2026-08-01" }, new Map())).toBe(
      "Payroll 3",
    );
    expect(subjectOf("salary_payment", "p", null, { month: "2026-08-01" }, new Map())).toBe(
      "A salary payment",
    );
    expect(subjectOf("attendance", "a", { name: "Omar" }, null, new Map())).toBe("Omar");
  });
});

describe("customers and loyalty (0050, release X)", () => {
  it("reads a phone number as the café does", () => {
    expect(phoneText("+9647701234567")).toBe("0770 123 4567");
    expect(phoneText("+964531234567")).toBe("053 123 4567");
    expect(phoneText("+442079460958")).toBe("+442079460958");
    expect(addressText({ address: "Salim Street, house 12", directions: "the blue door" })).toBe(
      "Salim Street, house 12 (the blue door)",
    );
    expect(addressText({ address: "Salim Street", directions: null })).toBe("Salim Street");
  });

  it("takes a reward whole, never more than the bill comes to", () => {
    expect(rewardOff(7500, 1, 5000)).toEqual({ off: 5000, ok: true });
    expect(rewardOff(5000, 1, 5000)).toEqual({ off: 5000, ok: true });
    expect(rewardOff(1000, 1, 5000)).toEqual({ off: 5000, ok: false });
    expect(rewardOff(20000, 3, 5000)).toEqual({ off: 15000, ok: true });
    expect(rewardOff(7500, 0, 5000)).toEqual({ off: 0, ok: true });
  });

  it("reads a customer at the till, and what a sale did for them", () => {
    const c = tillCustomerFrom({
      id: "c1",
      name: "Hawre",
      phone: "+9647701234567",
      notes: null,
      active: true,
      points: 107,
      rewards: 1,
      reward_points: 100,
      reward_value: 5000,
      loyalty: true,
      addresses: [{ id: "a1", label: "Home", address: "Salim Street", directions: null }],
    });
    expect(c?.rewards).toBe(1);
    expect(c?.addresses[0]?.active).toBe(true);
    expect(tillCustomerFrom(null)).toBeNull();
    expect(
      saleCustomerFrom({ customer_id: "c1", name: "Hawre", earned: 2, spent: 100, points: 9 }),
    ).toEqual({
      customerId: "c1",
      name: "Hawre",
      earned: 2,
      spent: 100,
      points: 9,
    });
    expect(saleCustomerFrom(null)).toBeNull();
    expect(
      customerReportFrom({ points: { earned: 35, rewards_value: 20000 }, outstanding: 203 }).points
        .rewardsValue,
    ).toBe(20000);
  });

  it("saves a bill whose customer changed", () => {
    const bill = {
      tabId: "t1",
      version: 3,
      tableId: null,
      tableName: null,
      label: "Hawre",
      channel: "dine_in" as const,
      businessDay: "2026-09-29",
      openedAt: "2026-09-29T08:00:00Z",
      openedBy: "Sara",
      billPrintedAt: null,
      billPrintCount: 0,
      lines: [],
      subtotal: 0,
      discount: 0,
      discountPercent: null,
      discountAmount: null,
      total: 0,
      customer: {
        id: "c1",
        name: "Hawre",
        phone: "+9647701234567",
        points: 107,
        addressId: null,
        address: null,
      },
    };
    const o = orderFromBill(bill);
    expect(o.customer?.name).toBe("Hawre");
    expect(isDirty(o)).toBe(false);
    expect(isDirty({ ...o, customer: null })).toBe(true);
    expect(isDirty({ ...o, customer: { ...o.customer!, addressId: "a1", address: "Home" } })).toBe(
      true,
    );
    expect(quickOrder("dine_in").customer).toBeNull();
  });

  it("names the loyalty rules on Settings, in the order the café reads them", () => {
    expect(RULE_ORDER.slice(-4)).toEqual([
      "loyalty",
      "loyalty_point_per",
      "loyalty_reward_points",
      "loyalty_reward_value",
    ]);
    for (const k of RULE_ORDER) {
      expect(SETTINGS_RULE_LABEL[k]).toBeTruthy();
      expect(SETTINGS_RULE_HELP[k]).toBeTruthy();
    }
    // A rule of points is read as one.
    const r = parseBusinessRules({
      definitions: { loyalty_reward_points: { kind: "points", min: 1, max: 100000, whole: true } },
      rows: [],
    });
    expect(r.definitions[0]?.kind).toBe("points");
  });

  it("has every word of the customer screens in Arabic and Kurdish", () => {
    for (const locale of ["ar", "ckb"] as const) {
      const words = builtInWords(locale);
      expect(
        CUSTOMER_PHRASES.filter((p) => !words[p]),
        locale,
      ).toEqual([]);
    }
  });

  it("names a customer on the audit trail", () => {
    expect(subjectOf("customer", "c1", null, { name: "Hawre" }, new Map())).toBe("Hawre");
    expect(subjectOf("customer", "c1", { customer: "Hawre" }, null, new Map())).toBe("Hawre");
    expect(subjectOf("customer", "c1", null, null, new Map())).toBe("A customer");
    expect(fieldLabel("customer_notes")).toBe("Notes about them");
  });
});

describe("the sales analysis, the stock's value on a day and what was bought (0051, release Y)", () => {
  it("knows the ways the sales are seen, and which go together", () => {
    expect(isSalesDimension("hour")).toBe(true);
    expect(isSalesDimension("colour")).toBe(false);
    expect(analysisGrain("product", null)).toBe("line");
    expect(analysisGrain("hour", "addon")).toBe("addon");
    expect(analysisGrain("employee", "payment")).toBe("payment");
    expect(analysisProblem("product", "product", null)).toBe(
      "Choose something else to see them by next",
    );
    expect(analysisProblem("payment", "product", null)).toMatch(/^A payment pays for a whole sale/);
    expect(analysisProblem("payment", null, "c1")).toMatch(/^A payment pays for a whole sale/);
    expect(analysisProblem("payment", "hour", null)).toBeNull();
    expect(analysisProblem("product", "channel", "c1")).toBeNull();
  });

  it("reads the analysis as the database gives it", () => {
    const a = salesAnalysisFrom({
      from: "2026-09-29",
      to: "2026-09-29",
      by: "product",
      then: "channel",
      grain: "line",
      rows: [
        {
          key: "p1",
          names: { en: "Golden espresso", ar: "إسبريسو" },
          key2: "dine_in",
          names2: { en: "dine_in" },
          orders: 3,
          qty: 5,
          gross: "12500",
          discount: 250,
          net: 12250,
          cost: 1000,
          margin: 11250,
          refunded: 2500,
          cost_back: 0,
          kept: 9750,
          margin_kept: 8750,
        },
      ],
      row_count: 1,
      truncated: false,
      total: { orders: 4, net: 17300, refunded: 2500, kept: 14800 },
      voided: { orders: 1, net: 1000 },
      cancelled_bills: 1,
      choices: {
        people: [{ id: "u1", name: "Demo Cashier" }],
        categories: [{ id: "c1", names: { en: "Hot drinks", ar: "مشروبات ساخنة" } }],
        branches: [{ id: "l1", name: "Main" }],
      },
    });
    expect(a.by).toBe("product");
    expect(a.then).toBe("channel");
    expect(a.rows[0]).toMatchObject({ key: "p1", key2: "dine_in", gross: 12500, kept: 9750 });
    expect(a.rows[0]?.names.ar).toBe("إسبريسو");
    expect(a.total).toMatchObject({ orders: 4, net: 17300, refunded: 2500, kept: 14800, paid: 0 });
    expect(a.voided).toEqual({ orders: 1, net: 1000 });
    expect(a.cancelledBills).toBe(1);
    expect(a.choices.categories[0]?.names.ar).toBe("مشروبات ساخنة");
    // What it does not know it reads as the product analysis, of nothing.
    const empty = salesAnalysisFrom(null);
    expect(empty.by).toBe("product");
    expect(empty.rows).toEqual([]);
  });

  it("names each row as the screen shows it", () => {
    const channel = (c: string) => (c === "dine_in" ? "Dine-in" : c);
    expect(rowName("hour", "8", { en: "8" }, "en", channel)).toEqual({
      text: "08:00",
      phrase: false,
    });
    expect(rowName("weekday", "0", { en: "0" }, "en", channel)).toEqual({
      text: "Saturday",
      phrase: true,
    });
    expect(rowName("weekday", "6", { en: "6" }, "en", channel).text).toBe("Friday");
    expect(rowName("payment", "card", { en: "card" }, "en", channel)).toEqual({
      text: "Card",
      phrase: true,
    });
    expect(rowName("channel", "dine_in", { en: "dine_in" }, "ar", channel).text).toBe("Dine-in");
    expect(rowName("category", "none", { en: "No category" }, "ar", channel)).toEqual({
      text: "No category",
      phrase: true,
    });
    expect(rowName("employee", "none", { en: "No one" }, "en", channel).text).toBe("No one");
    const names = { en: "Golden espresso", ar: "إسبريسو ذهبي" };
    expect(rowName("product", "p1", names, "ar", channel).text).toBe("إسبريسو ذهبي");
    expect(rowName("product", "p1", names, "ckb", channel).text).toBe("Golden espresso");
  });

  it("draws each row's bar as its share of the largest", () => {
    expect(barWidth(50, 100)).toBe(50);
    expect(barWidth(100, 100)).toBe(100);
    expect(barWidth(0.1, 100)).toBe(1);
    expect(barWidth(0, 100)).toBe(0);
    expect(barWidth(-5, 100)).toBe(0);
    expect(barWidth(5, 0)).toBe(0);
  });

  it("reads the stock's value on a day and what was bought", () => {
    const v = stockValueFrom({
      as_of: "2026-09-29",
      items: [
        {
          item_id: "i1",
          name: "Golden beans",
          type: "ingredient",
          unit: "g",
          qty: 880,
          value: 8800,
          unit_cost: 10,
        },
      ],
      by_type: [{ type: "ingredient", items: 1, value: 8800 }],
      stock: 19250,
      ledger: 19250,
      difference: 0,
    });
    expect(v.items[0]).toMatchObject({ name: "Golden beans", qty: 880, value: 8800, unitCost: 10 });
    expect(v.difference).toBe(0);
    // At one branch there is no ledger to set it against.
    expect(stockValueFrom({ stock: 5, ledger: null, difference: null }).ledger).toBeNull();
    const b = purchasesFrom({
      suppliers: [
        {
          supplier_id: "s1",
          name: "Kurdistan Coffee Imports",
          deliveries: 1,
          received: 18000,
          returned: 9000,
          net: 9000,
        },
      ],
      items: [
        {
          item_id: "i1",
          name: "Golden beans",
          unit: "g",
          qty: 2000,
          received: 18000,
          unit_cost: 9,
          qty_back: 1000,
        },
      ],
      total: { deliveries: 1, received: 18000, returns: 1, returned: 9000, net: 9000 },
    });
    expect(b.suppliers[0]).toMatchObject({
      name: "Kurdistan Coffee Imports",
      net: 9000,
      priceCredits: 0,
    });
    expect(b.items[0]).toMatchObject({ qty: 2000, unitCost: 9, qtyBack: 1000 });
    expect(b.total).toMatchObject({ deliveries: 1, net: 9000 });
  });

  it("has every word of the analysis in Arabic and Kurdish", () => {
    for (const locale of ["ar", "ckb"] as const) {
      const words = builtInWords(locale);
      expect(
        ANALYSIS_PHRASES.filter((p) => !words[p]),
        locale,
      ).toEqual([]);
    }
  });
});

describe("the balance sheet and the cash flow (0052, release Z)", () => {
  const sheet = (asOf: string, lines: [string, string, number][], extra = {}) =>
    balanceSheetFrom({
      as_of: asOf,
      year_from: "2026-01-01",
      lines: lines.map(([code, group, amount]) => ({
        code,
        name: `Account ${code}`,
        section: group === "liability" || group === "equity" ? group : "asset",
        group,
        amount,
      })),
      ...extra,
    });

  it("reads the balance sheet as the database gives it", () => {
    const b = sheet("2026-09-29", [["1000", "cash", 4200]], {
      cash: "4200",
      current_assets: 4200,
      fixed_assets: 150000,
      assets: 154200,
      liabilities: 8000,
      equity: 151000,
      profit_this_year: -5560,
      profit_earlier: 760,
      equity_total: 146200,
      liabilities_and_equity: 154200,
      difference: 0,
    });
    expect(b.asOf).toBe("2026-09-29");
    expect(b.lines[0]).toEqual({
      code: "1000",
      name: "Account 1000",
      section: "asset",
      group: "cash",
      amount: 4200,
    });
    expect(b).toMatchObject({
      cash: 4200,
      assets: 154200,
      profitThisYear: -5560,
      profitEarlier: 760,
    });
    expect(b.difference).toBe(0);
    // A group it does not know it reads as a current asset; nothing, as nothing.
    expect(
      balanceSheetFrom({ lines: [{ code: "1999", group: "odd", amount: 5 }] }).lines[0]?.group,
    ).toBe("current");
    expect(balanceSheetFrom(null)).toMatchObject({ lines: [], assets: 0, difference: 0 });
  });

  it("sets the two balance sheets side by side, account by account", () => {
    const start = sheet("2026-08-31", [
      ["1020", "cash", 402940],
      ["1005", "cash", 50000],
      ["3000", "equity", 450000],
    ]);
    const end = sheet("2026-09-29", [
      ["1000", "cash", 4200],
      ["1005", "cash", 6500],
      ["1020", "cash", 242940],
      ["1500", "fixed", 150000],
      ["2000", "liability", 8000],
      ["3000", "equity", 471000],
      ["3200", "equity", -20000],
    ]);
    const rows = balanceRows(start, end);
    expect(rows.cash).toEqual([
      { code: "1000", name: "Account 1000", start: 0, end: 4200 },
      { code: "1005", name: "Account 1005", start: 50000, end: 6500 },
      { code: "1020", name: "Account 1020", start: 402940, end: 242940 },
    ]);
    expect(rows.fixed).toEqual([{ code: "1500", name: "Account 1500", start: 0, end: 150000 }]);
    expect(rows.liability.map((r) => [r.code, r.start, r.end])).toEqual([["2000", 0, 8000]]);
    expect(rows.equity.map((r) => [r.code, r.start, r.end])).toEqual([
      ["3000", 450000, 471000],
      ["3200", 0, -20000],
    ]);
    expect(rows.current).toEqual([]);
  });

  it("reads the cash flow as the database gives it", () => {
    const f = cashFlowFrom({
      from: "2026-09-29",
      to: "2026-09-29",
      cash: [{ code: "1000", name: "Cash in the till", opening: 0, closing: 4200 }],
      opening: 452940,
      closing: 253640,
      lines: [
        {
          line: "sales",
          section: "operating",
          amount: 7000,
          in: 9500,
          out: "2500",
          journals: 4,
          accounts: [{ code: "4000", name: "Sales revenue", amount: 12500 }],
        },
      ],
      operating: -29500,
      investing: -150000,
      financing: -20000,
      exchange: 200,
      net: -199300,
      difference: 0,
    });
    expect(f.lines[0]).toMatchObject({ line: "sales", amount: 7000, cameIn: 9500, wentOut: 2500 });
    expect(f.lines[0]?.accounts[0]).toEqual({ code: "4000", name: "Sales revenue", amount: 12500 });
    expect(f.cash[0]).toMatchObject({ opening: 0, closing: 4200 });
    expect(f.opening + f.net).toBe(f.closing);
    expect(f.operating + f.investing + f.financing + f.exchange).toBe(f.net);
    expect(cashFlowFrom(undefined)).toMatchObject({ lines: [], opening: 0, net: 0 });
  });

  it("names every line of the cash flow, each in its section", () => {
    expect(cashFlowLabel("sales")).toEqual({ text: "Received from sales", phrase: true });
    expect(cashFlowLabel("owner").text).toBe("The owner's money in and out");
    // A line the database adds later shows by its key until it has words.
    expect(cashFlowLabel("loans")).toEqual({ text: "loans", phrase: false });
    const sections = CASH_FLOW_SECTIONS.map((s) => s.key);
    expect(sections).toEqual(["operating", "investing", "financing", "exchange"]);
    expect(CASH_FLOW_LINES.every((l) => sections.includes(l.section))).toBe(true);
    expect(CASH_FLOW_LINES.map((l) => l.key)).toEqual([
      "sales",
      "stock",
      "staff",
      "running",
      "counts",
      "equipment",
      "owner",
      "exchange",
    ]);
  });

  it("has every word of the statements in Arabic and Kurdish", () => {
    for (const locale of ["ar", "ckb"] as const) {
      const words = builtInWords(locale);
      expect(
        STATEMENT_PHRASES.filter((p) => !words[p]),
        locale,
      ).toEqual([]);
    }
  });
});

describe("documents kept with the records (0053, release AA)", () => {
  const migration = readFileSync(
    join(__dirname, "../supabase/migrations/0053_attachments.sql"),
    "utf8",
  );

  it("knows the records that keep documents, and who attaches them, as the database does", () => {
    const fn = migration.slice(migration.indexOf("function document_permissions("));
    const cases = [
      ...fn.slice(0, fn.indexOf("$$;")).matchAll(/when '([a-z_]+)' then array\[([^\]]*)\]/g),
    ].map((m) => [m[1]!, m[2]!.split(",").map((p) => p.trim().replace(/'/g, ""))]);
    expect(Object.fromEntries(cases)).toEqual(DOCUMENT_PERMISSIONS);
    expect([...DOCUMENT_KINDS]).toEqual(Object.keys(DOCUMENT_PERMISSIONS));
  });

  it("keeps a file under the café, the kind of record and the record, by a name of its own", () => {
    expect(documentPath("b1", "expense", "e1", "f1", "application/pdf")).toBe(
      "b1/expense/e1/f1.pdf",
    );
    expect(documentPath("b1", "goods_receipt", "r1", "f2", "image/jpeg")).toBe(
      "b1/goods_receipt/r1/f2.jpg",
    );
    expect(documentPath("b1", "supplier_credit", "c1", "f3", "image/webp")).toMatch(/\.webp$/);
  });

  it("names a document as typed, or by its file's own name; 200 letters at most", () => {
    expect(documentName("  Delivery   note ", "IMG_1024.jpg")).toBe("Delivery note");
    expect(documentName("", "IMG_1024.jpg")).toBe("IMG_1024.jpg");
    expect(documentName("پسووڵەی گەیاندن", "x.jpg")).toBe("پسووڵەی گەیاندن");
    expect([...documentName("ا".repeat(250), "x.pdf")].length).toBe(200);
  });

  it("takes a picture or a PDF, 10 MB at most, and says why not in words", () => {
    expect(fileProblem("text/plain", 20)).toBe(
      "A document is a picture (JPEG, PNG or WebP) or a PDF",
    );
    expect(fileProblem("image/heic", 20)).not.toBeNull();
    expect(fileProblem("application/pdf", 0)).toBe("That file is empty");
    expect(fileProblem("image/png", 10 * 1024 * 1024 + 1)).toBe("A document is at most 10 MB");
    expect(fileProblem("image/webp", 10 * 1024 * 1024)).toBeNull();
    expect(fileProblem("application/pdf", 80_000)).toBeNull();
  });

  it("makes a large photo smaller before it is sent, and never a small one bigger", () => {
    expect(shouldShrink("image/jpeg", 3_000_000)).toBe(true);
    expect(shouldShrink("image/jpeg", 1_000_000)).toBe(false);
    expect(shouldShrink("application/pdf", 9_000_000)).toBe(false);
    expect(shrunkSize(4000, 3000)).toEqual({ width: 2000, height: 1500 });
    expect(shrunkSize(3024, 4032)).toEqual({ width: 1500, height: 2000 });
    expect(shrunkSize(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it("says a file's size as a person reads it", () => {
    expect(sizeLabel(820)).toEqual({ phrase: "{n} bytes", n: "820" });
    expect(sizeLabel(348_160)).toEqual({ phrase: "{n} KB", n: "340" });
    expect(sizeLabel(2.4 * 1024 * 1024)).toEqual({ phrase: "{n} MB", n: "2.4" });
  });

  it("reads a record's page as the database gives it", () => {
    const r = documentRecordFrom({
      kind: "purchase_invoice",
      record_id: "b1",
      no: "KC-7",
      supplier: "Kurdistan Coffee Imports",
      date: "2026-09-29",
      amount: 18000,
      may_attach: true,
      documents: [
        {
          id: "d2",
          file_name: "KC-7.pdf",
          content_type: "application/pdf",
          size: 80000,
          note: null,
          attached_at: "2026-09-29T10:00:00Z",
          attached_by: "Demo Accountant",
        },
      ],
      removed: [
        {
          id: "d1",
          file_name: "old.jpg",
          content_type: "image/jpeg",
          size: 150000,
          attached_at: "2026-09-29T09:00:00Z",
          attached_by: "Demo Manager",
          removed_at: "2026-09-29T09:30:00Z",
          removed_by: "Demo Manager",
          removed_reason: "The wrong bill",
        },
      ],
    });
    expect(r?.no).toBe("KC-7");
    expect(r?.amount).toBe(18000);
    expect(r?.text).toBeNull();
    expect(r?.mayAttach).toBe(true);
    expect(r?.documents.map((d) => `${d.fileName} ${d.size} ${d.attachedBy}`)).toEqual([
      "KC-7.pdf 80000 Demo Accountant",
    ]);
    expect(r?.removed.map((d) => `${d.fileName}: ${d.reason} (${d.removedBy})`)).toEqual([
      "old.jpg: The wrong bill (Demo Manager)",
    ]);
    expect(documentRecordFrom({ kind: "stock_count", record_id: "x" })).toBeNull();
    expect(documentRecordFrom(null)).toBeNull();
  });

  it("counts the records that keep documents", () => {
    expect(documentCountsFrom({ r1: 2, r2: 0, r3: "3" })).toEqual({ r1: 2, r3: 3 });
    expect(documentCountsFrom(null)).toEqual({});
  });

  it("names each document attached or taken off on the audit trail, by its record", () => {
    const actions = [
      ...new Set(
        [...migration.matchAll(/audit_event\(v_business, '([a-z_.]+)'/g)].map((m) => m[1]!),
      ),
    ];
    expect(actions).toEqual(["document.attach", "document.detach"]);
    for (const a of actions) {
      expect(actionLabel(a), a).not.toBe(a);
      expect(auditGroup("documents")?.prefixes.some((p) => a.startsWith(p))).toBe(true);
    }
    const names = new Map<string, string>();
    expect(
      subjectOf(
        "goods_receipt",
        "r",
        { receipt_no: 12 },
        { receipt_no: 12, document: "a.jpg" },
        names,
      ),
    ).toBe("Receipt 12");
    expect(subjectOf("purchase_invoice", "b", { invoice_no: "KC-7" }, null, names)).toBe(
      "Supplier bill KC-7",
    );
    expect(subjectOf("supplier_return", "x", { return_no: 3 }, null, names)).toBe("Return 3");
    expect(subjectOf("supplier_credit", "c", { credit_no: 2 }, null, names)).toBe("Credit 2");
    expect(subjectOf("expense", "e", { description: "Cleaning cloths" }, null, names)).toBe(
      "Cleaning cloths",
    );
    // What changed is the document; the record's number is the same before and after.
    expect(
      describeChanges({ receipt_no: 12 }, { receipt_no: 12, document: "Delivery note.jpg" }, names),
    ).toEqual([{ field: "Document", before: "—", after: "Delivery note.jpg" }]);
    expect(
      describeChanges({ invoice_no: "KC-7", document: "KC-7.pdf" }, { invoice_no: "KC-7" }, names),
    ).toEqual([{ field: "Document", before: "KC-7.pdf", after: "—" }]);
  });

  it("has every word of the documents in Arabic and Kurdish", () => {
    for (const locale of ["ar", "ckb"] as const) {
      const words = builtInWords(locale);
      expect(
        [
          ...DOCUMENT_PHRASES,
          "Document attached",
          "Document taken off",
          "Documents kept with records",
          "Document",
        ].filter((p) => !words[p]),
        locale,
      ).toEqual([]);
    }
  });
});

describe("the audit trail in the reader's language", () => {
  it("names a language's writing, its words cleared, and a refund paid back more than one way", () => {
    const names = new Map<string, string>();
    expect(
      describeChanges({ dir: "ltr" }, { dir: "rtl" }, names).map((c) => [c.field, c.after]),
    ).toEqual([["Writing direction", "Right to left"]]);
    expect(describeChanges(null, { set: 2, cleared: 1 }, names).map((c) => c.field)).toEqual([
      "Set",
      "Cleared",
    ]);
    const back = showValue(
      [
        { type: "card", amount: 2000 },
        { type: "cash", amount: 500 },
      ],
      "tenders",
      names,
    );
    expect(back).toBe("Card 2,000, Cash 500");
    const ar = translator(builtInWords("ar"));
    const msg = (s: string) => s;
    expect(valueIn(back, "Paid back", ar, msg)).toBe(`${ar("Card")} 2,000, ${ar("Cash")} 500`);
    expect(valueIn("Right to left", "Writing direction", ar, msg)).toBe(ar("Right to left"));
    for (const locale of ["ar", "ckb"] as const) {
      const words = builtInWords(locale);
      expect(
        [
          "Writing direction",
          "Cleared",
          "Paid back",
          "Set",
          "Right to left",
          "Left to right",
        ].filter((p) => !words[p]),
        locale,
      ).toEqual([]);
    }
  });
});

describe("the books by place (0056, release AB)", () => {
  it("lays each place's profit and loss beside the shared and the café's", () => {
    const row = (
      code: string,
      section: PnlPlaceRow["section"],
      placeId: string | null,
      place: string | null,
      amount: number,
    ): PnlPlaceRow => ({ code, name: `Account ${code}`, section, placeId, place, amount });
    const rows = [
      row("4000", "revenue", "m", "Main Branch", 8000),
      row("4000", "revenue", "s", "Second Branch", 5500),
      row("5000", "cost_of_sales", "m", "Main Branch", 650),
      row("5300", "cost_of_sales", "k", "Central Kitchen", 500),
      row("6900", "operating_expenses", null, null, 1000),
      row("6900", "operating_expenses", "old", "Old Branch", 200),
    ];
    const places = [
      { id: "m", name: "Main Branch" },
      { id: "s", name: "Second Branch" },
      { id: "k", name: "Central Kitchen" },
    ];
    const table = pnlByPlace(rows, places);
    // The café's places in order, one since closed that has an amount, then the shared.
    expect(table.columns.map((c) => c.name)).toEqual([
      "Main Branch",
      "Second Branch",
      "Central Kitchen",
      "Old Branch",
      "Shared",
    ]);
    expect(table.lines.map((l) => [l.code, ...l.amounts, l.total])).toEqual([
      ["4000", 8000, 5500, 0, 0, 0, 13500],
      ["5000", 650, 0, 0, 0, 0, 650],
      ["5300", 0, 0, 500, 0, 0, 500],
      ["6900", 0, 0, 0, 200, 1000, 1200],
    ]);
    expect(table.totals.map((x) => x.net)).toEqual([7350, 5500, -500, -200, -1000]);
    expect(table.total).toEqual({
      revenue: 13500,
      costOfSales: 1150,
      grossProfit: 12350,
      operating: 1200,
      net: 11150,
    });
    // Each column's net adds up to the café's.
    expect(table.totals.reduce((t, x) => t + x.net, 0)).toBe(table.total.net);
    // Nothing shared, no shared column.
    expect(pnlByPlace(rows.slice(0, 2), places.slice(0, 1)).columns.map((c) => c.id)).toEqual([
      "m",
      "s",
    ]);
  });
});

describe("the chart of accounts on a screen (0058)", () => {
  const migration = readFileSync(
    join(__dirname, "../supabase/migrations/0058_chart_of_accounts.sql"),
    "utf8",
  );

  it("proposes the next free code of ten, from the kind's own first", () => {
    const taken = [{ code: "4000" }, { code: "6000" }, { code: "6010" }];
    expect(nextFreeCode(taken, "expense")).toBe("6020");
    expect(nextFreeCode(taken, "revenue")).toBe("4300");
    expect(nextFreeCode([...taken, { code: "4300" }], "revenue")).toBe("4310");
    // Every code of ten taken: the first free one of the range.
    const tens = Array.from({ length: 100 }, (_, i) => ({ code: String(6000 + i * 10) }));
    expect(nextFreeCode(tens, "expense")).toBe("5000");
  });

  it("does not let an account's words become a word the screens use", () => {
    // "delivery" is the channel's word as well as the supplier's "Delivery".
    for (const name of ["Delivery", "delivery", "Other", " Staff  meals ", "Packaging"])
      expect([name, isScreenWord(name)]).toEqual([name, true]);
    for (const name of ["Delivery costs", "Repairs", "Bank interest", "Shop rent", "other costs"])
      expect([name, isScreenWord(name)]).toEqual([name, false]);
    // Added without other names, it writes no words and shows the screens' own.
    expect(screenWordRefusal("Packaging", false, false)).toBeNull();
    // Given its own Arabic or Kurdish, they would be that word's on every screen.
    expect(screenWordRefusal("Packaging", true, false)).toBe(SCREEN_WORD_NAME);
    // Renamed, the database carries its words from its old name: refused either way.
    expect(screenWordRefusal("Packaging", false, true)).toBe(SCREEN_WORD_RENAME);
    expect(screenWordRefusal("Delivery costs", true, true)).toBeNull();
    // Both actions ask, adding and renaming.
    const actions = readFileSync(join(__dirname, "../src/lib/actions/books.ts"), "utf8");
    expect(
      actions.match(
        /screenWordRefusal\(v\.data\.name, Boolean\(v\.data\.nameAr \|\| v\.data\.nameCkb\), (false|true)\)/g,
      ),
    ).toEqual([
      "screenWordRefusal(v.data.name, Boolean(v.data.nameAr || v.data.nameCkb), false)",
      "screenWordRefusal(v.data.name, Boolean(v.data.nameAr || v.data.nameCkb), true)",
    ]);
  });

  it("names each change to an account on the audit trail, in the reader's language", () => {
    for (const a of ["account.create", "account.rename", "account.in_use"]) {
      expect(migration).toContain(`'${a}'`);
      expect(actionLabel(a)).not.toBe(a);
    }
    expect(auditGroup("books")?.prefixes).toContain("account.");
    const names = new Map<string, string>();
    const added = { name: "Repairs", account_type: "expense", names: { ar: "الإصلاحات" } };
    expect(subjectOf("gl_account", "6010", null, added, names)).toBe("Account 6010 Repairs");
    expect(subjectOf("gl_account", null, null, {}, names)).toBe("An account");
    expect(describeChanges(null, added, names).map((c) => [c.field, c.after])).toEqual([
      ["Name", "Repairs"],
      ["Class", "Expense"],
      ["In other languages", "ar الإصلاحات"],
    ]);
    // Taken out of use: the name, unchanged, is its subject and not a change.
    expect(
      describeChanges(
        { name: "Repairs", is_active: true },
        { name: "Repairs", is_active: false },
        names,
      ).map((c) => [c.field, c.before, c.after]),
    ).toEqual([["In use", "yes", "no"]]);
    const ar = translator(builtInWords("ar"));
    const msg = (s: string) => (s === "Repairs" ? "الإصلاحات" : s);
    expect(subjectIn("Account 6010 Repairs", "account.in_use", ar, msg)).toBe(
      ar("Account {code} {name}", { code: "6010", name: "الإصلاحات" }),
    );
    expect(subjectIn("An account", "account.create", ar, msg)).toBe(ar("An account"));
    expect(valueIn("Expense", "Class", ar, msg)).toBe(ar("Expense"));
    for (const locale of ["ar", "ckb"] as const) {
      const words = builtInWords(locale);
      expect(
        [
          "Account added",
          "Account renamed",
          "Account taken out of use or brought back",
          "Account {code} {name}",
          "Account {code}",
          "An account",
          "Class",
          "Expense",
          "Income",
        ].filter((p) => !words[p]),
        locale,
      ).toEqual([]);
    }
  });
});

describe("the bank against its statement (0059)", () => {
  const migration = readFileSync(
    join(__dirname, "../supabase/migrations/0059_bank_reconciliation.sql"),
    "utf8",
  );

  it("adds up the lines ticked from the last statement, against the bank's balance", () => {
    const m = bankMath(940000, [-25000, "-5000"], "910,000");
    expect([m.moneyIn.toNumber(), m.moneyOut.toNumber(), m.reached.toNumber()]).toEqual([
      0, 30000, 910000,
    ]);
    expect(m.difference?.isZero()).toBe(true);
    // Overdrawn is below zero, and Arabic digits are read.
    const o = bankMath(0, [-150000], "-١٥٠٠٠٠");
    expect(o.difference?.isZero()).toBe(true);
    // Not typed yet, or not a number: no difference to show.
    expect(bankMath(0, [1000], "").difference).toBeNull();
    expect(bankMath(0, [1000], "abc").closing).toBeNull();
    // Apart: the bank's balance less where the lines take it.
    expect(bankMath(940000, [-25000], "900000").difference?.toNumber()).toBe(-15000);
  });

  it("offers a statement only the lines to its last day", () => {
    const lines = [{ day: "2026-09-20" }, { day: "2026-09-25" }, { day: "2026-09-29" }];
    expect(linesTo(lines, "2026-09-25").map((l) => l.day)).toEqual(["2026-09-20", "2026-09-25"]);
    expect(linesTo(lines, "")).toEqual([]);
  });

  it("names each statement kept or undone on the audit trail, in the reader's language", () => {
    for (const a of ["bank.reconcile", "bank.unreconcile"]) {
      expect(migration).toContain(`'${a}'`);
      expect(actionLabel(a)).not.toBe(a);
    }
    expect(auditGroup("books")?.prefixes).toContain("bank.");
    const names = new Map<string, string>();
    const kept = {
      statement_no: 3,
      statement_date: "2026-09-29",
      opening_balance: 940000,
      closing_balance: 910000,
      line_count: 2,
      money_in: 0,
      money_out: 30000,
    };
    expect(subjectOf("bank_statement", "x", null, kept, names)).toBe("Bank statement 3");
    expect(subjectOf("bank_statement", null, null, {}, names)).toBe("A bank statement");
    expect(describeChanges(null, kept, names).map((c) => c.field)).toEqual([
      "Bank statement",
      "Its last day",
      "From the last statement",
      "The bank's balance",
      "Lines ticked",
      "Money in",
      "Money out",
    ]);
    const ar = translator(builtInWords("ar"));
    const msg = (s: string) => s;
    expect(subjectIn("Bank statement 3", "bank.reconcile", ar, msg)).toBe(
      ar("Bank statement {no}", { no: "3" }),
    );
    expect(valueIn("undone", "Status", ar, msg)).toBe(ar("undone"));
    for (const locale of ["ar", "ckb"] as const) {
      const words = builtInWords(locale);
      expect(
        [
          "Bank statement kept",
          "Bank statement undone",
          "Bank statement {no}",
          "A bank statement",
          "Bank statement",
          "Its last day",
          "From the last statement",
          "The bank's balance",
          "Lines ticked",
          "Money in",
          "Money out",
          "kept",
          "undone",
          "Bank not reconciled",
        ].filter((p) => !words[p]),
        locale,
      ).toEqual([]);
    }
  });
});

describe("find a sale on Orders (the September audit's P2-20)", () => {
  it("reads the receipt's sale number as the ids that begin with it, or the whole id", () => {
    expect(readSaleQuery("3FA9C2E1")?.ids).toEqual({
      from: "3fa9c2e1-0000-0000-0000-000000000000",
      to: "3fa9c2e1-ffff-ffff-ffff-ffffffffffff",
    });
    const id = "3fa9c2e1-1111-4222-8333-444455556666";
    expect(readSaleQuery(` ${id.toUpperCase()} `)?.ids).toEqual({ from: id, to: id });
    // A sale number is not a customer's name.
    expect(readSaleQuery("3fa9c2e1")?.name).toBeUndefined();
  });

  it("reads a number as a journal's or a refund's, and as an order number too", () => {
    expect(readSaleQuery("1024")).toMatchObject({ number: 1024, platformOrder: "1024" });
    expect(readSaleQuery("#1024")?.number).toBe(1024);
    // In Arabic-Indic or Eastern Arabic-Indic digits, as a phone's keyboard types them.
    expect(readSaleQuery("١٠٢٤")?.number).toBe(1024);
    expect(readSaleQuery("۱۰۲۴")?.number).toBe(1024);
    // Eight digits are a sale number, a journal number and an order number at once.
    expect(readSaleQuery("12345678")).toMatchObject({
      number: 12345678,
      platformOrder: "12345678",
      ids: { from: "12345678-0000-0000-0000-000000000000" },
    });
  });

  it("reads the platform's order number as its tablet shows it", () => {
    expect(readSaleQuery("TB-99/7")?.platformOrder).toBe("TB-99/7");
    expect(readSaleQuery(" # tb 99 ")?.platformOrder).toBe("tb99");
  });

  it("reads a customer's name in any script, and their phone typed any way", () => {
    expect(readSaleQuery("Ali")?.name).toBe("Ali");
    expect(readSaleQuery("  هاوڕێ   ئەحمەد ")?.name).toBe("هاوڕێ ئەحمەد");
    expect(readSaleQuery("0770 123 4567")?.phoneTail).toBe("7701234567");
    expect(readSaleQuery("+964 770-123-4567")?.phoneTail).toBe("7701234567");
    expect(readSaleQuery("٠٧٧٠١٢٣٤٥٦٧")?.phoneTail).toBe("7701234567");
    expect(phoneTail("00964 53 123 4567")).toBe("531234567");
    // Too short to be a phone: a number, not a phone's end.
    expect(phoneTail("1024")).toBeNull();
    expect(phoneTail("Ali")).toBeNull();
  });

  it("reads nothing from nothing, or from more than a search holds", () => {
    expect(readSaleQuery("")).toBeNull();
    expect(readSaleQuery("   ")).toBeNull();
    expect(readSaleQuery(null)).toBeNull();
    expect(readSaleQuery("x".repeat(61))).toBeNull();
  });

  it("takes %, _ and \\ typed in a search as themselves", () => {
    expect(likeText("50%_off")).toBe("50\\%\\_off");
    expect(likeText("a\\b")).toBe("a\\\\b");
  });
});

describe("find a journal, and a product (the September audit's P2-20)", () => {
  it("reads a search box's text as it is looked for", () => {
    expect(searchText("  #  ١٠٢٤  ")).toBe("1024");
    expect(searchText("rent   for   September")).toBe("rent for September");
    expect(searchText("   ")).toBeNull();
    expect(searchText("x".repeat(61))).toBeNull();
  });

  it("finds a journal by its number, or by words in it", () => {
    expect(readJournalQuery("1024")).toEqual({ number: 1024, words: "1024" });
    expect(readJournalQuery("rent")).toEqual({ words: "rent" });
    // One letter or digit alone is a number, not words.
    expect(readJournalQuery("7")).toEqual({ number: 7 });
    expect(readJournalQuery("x")).toBeNull();
  });

  it("finds a product by part of its name or a size's, in any language and letter form", () => {
    const latte = ["Latte", "لاتيه", "لاتێ", "Regular", "Large", "كبير", "گەورە"];
    expect(namesMatch(latte, "lat")).toBe(true);
    expect(namesMatch(latte, "LARGE")).toBe(true);
    expect(namesMatch(latte, "لاتي")).toBe(true);
    // Kurdish and Arabic letter forms are the same letter to a search (ی and ي, ک and ك).
    expect(namesMatch(["کیک"], "كيك")).toBe(true);
    expect(namesMatch(latte, "mocha")).toBe(false);
    expect(namesMatch([null, undefined, ""], "a")).toBe(false);
    expect(namesMatch(latte, "  ")).toBe(false);
  });
});

describe("an expense paid ahead for months to come (0060, the September audit's P2-14)", () => {
  const migration = readFileSync(
    join(__dirname, "../supabase/migrations/0060_prepaid_expenses.sql"),
    "utf8",
  );

  it("counts months across the turn of a year, both ways", () => {
    expect(addMonths("2026-09", 0)).toBe("2026-09");
    expect(addMonths("2026-09", 3)).toBe("2026-12");
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2026-09", 35)).toBe("2029-08");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
  });

  it("gives each month an equal share in whole dinars, the last what is left", () => {
    const shares = prepaidShares(1_000_000, 12, "2026-09");
    expect(shares).toHaveLength(12);
    expect(shares[0]).toEqual({ month: "2026-09", amount: 83_333 });
    expect(shares[10]).toEqual({ month: "2027-07", amount: 83_333 });
    expect(shares[11]).toEqual({ month: "2027-08", amount: 83_337 });
    expect(shares.reduce((s, x) => s + x.amount, 0)).toBe(1_000_000);
    // An amount that divides: every share the same.
    expect(new Set(prepaidShares(120_000, 12, "2026-10").map((x) => x.amount))).toEqual(
      new Set([10_000]),
    );
  });

  it("splits as the database does (tests/sql/prepaid.test.sql)", () => {
    // The rent: 100,000 over three months; the database posts 33,333, 33,333, 33,334.
    expect(prepaidShares(100_000, 3, "2026-09").map((x) => x.amount)).toEqual([
      33_333, 33_333, 33_334,
    ]);
    // The insurance's first share and the rent's second: the alert's 43,333.
    expect(prepaidShares(120_000, 12, "2026-10")[0]!.amount + 33_333).toBe(43_333);
  });

  it("spreads nothing it cannot: out of 1 to 36 months, or less than a dinar a month", () => {
    expect(PREPAID_MONTHS).toEqual({ min: 1, max: 36 });
    for (const months of [0, 37, 2.5, Number.NaN])
      expect(prepaidShares(100_000, months, "2026-09")).toEqual([]);
    expect(prepaidShares(2, 3, "2026-09")).toEqual([]);
    expect(prepaidShares(3, 3, "2026-09").map((x) => x.amount)).toEqual([1, 1, 1]);
    expect(prepaidShares(Number.NaN, 3, "2026-09")).toEqual([]);
    // One month to come, alone: December's rent paid in September, all December's.
    expect(prepaidShares(150_000, 1, "2026-12")).toEqual([{ month: "2026-12", amount: 150_000 }]);
  });

  it("splits what was typed as the database records it: rounded first, half to even (0061)", () => {
    expect(recordedAmount(300_000.5)).toBe(300_000);
    expect(recordedAmount(300_001.5)).toBe(300_002);
    expect(recordedAmount(Number.NaN)).toBeNaN();
    // 300,001.5 is recorded as 300,002: shares of 100,000, the last 100,002.
    expect(prepaidShares(300_001.5, 3, "2026-09").map((x) => x.amount)).toEqual([
      100_000, 100_000, 100_002,
    ]);
    // 2.6 is recorded as 3: three months take one each, and it is not refused.
    expect(prepaidRefusal(2.6, 3, "2026-10", "2026-09")).toBeNull();
    expect(prepaidShares(2.6, 3, "2026-10").map((x) => x.amount)).toEqual([1, 1, 1]);
    // A currency with two decimals: shares rounded down to them, the last what is left.
    expect(prepaidShares(100, 3, "2026-09", 2).map((x) => x.amount)).toEqual([33.33, 33.33, 33.34]);
  });

  it("knows a month's share among the journals: undone with its prepaid expense, not by hand", () => {
    const share = [
      { code: "6000", credit: 0 },
      { code: "1400", credit: 33_333 },
    ];
    expect(isPrepaidShare("expense", share)).toBe(true);
    // An ordinary expense, the prepaid expense's own payment, and its cancellation are not shares.
    expect(isPrepaidShare("expense", [{ code: "1020", credit: 33_333 }])).toBe(false);
    expect(isPrepaidShare("prepaid_expense", [{ code: "1020", credit: 100_000 }])).toBe(false);
    expect(isPrepaidShare("reversal", [{ code: "1400", credit: 100_000 }])).toBe(false);
    const fix = readFileSync(
      join(__dirname, "../supabase/migrations/0061_prepaid_and_payments.sql"),
      "utf8",
    );
    expect(fix).toContain(
      "A month''s share of a prepaid expense is undone by cancelling the prepaid expense on Expenses",
    );
  });

  it("refuses before it is sent what the database would refuse, in its words", () => {
    const now = "2026-09";
    expect(prepaidRefusal(300_000, 3, "2026-09", now)).toBeNull();
    expect(prepaidRefusal(150_000, 1, "2026-12", now)).toBeNull();
    expect(prepaidRefusal(150_000, 1, "2026-09", now)?.text).toBe(
      "For this month alone, record an expense",
    );
    for (const months of [0, 37, 1.5])
      expect(prepaidRefusal(150_000, months, "2026-10", now)?.text).toBe(
        "Say how many months it covers, 1 to 36",
      );
    expect(prepaidRefusal(150_000, 3, "2026-08", now)?.text).toBe(
      "Choose the first month it covers",
    );
    expect(prepaidRefusal(2, 3, "2026-10", now)).toEqual({
      text: "Each month takes at least 1 of it: pay at least {1}, or cover fewer months",
      vars: { 1: 3 },
    });
    for (const locale of ["ar", "ckb"] as const) {
      const words = builtInWords(locale);
      for (const [amount, months, first] of [
        [150_000, 1, "2026-09"],
        [150_000, 0, "2026-10"],
        [150_000, 3, "2026-08"],
        [2, 3, "2026-10"],
      ] as const)
        expect(words[prepaidRefusal(amount, months, first, now)!.text], locale).toBeTruthy();
    }
  });

  it("reads the list the database gives, and what each still holds in 1400", () => {
    const row = prepaidFrom({
      id: "0f0e0d0c-0b0a-0908-0706-050403020100",
      description: "Shop rent, three months",
      account_code: "6000",
      account_name: "Rent",
      paid_from: "bank",
      amount: "100000",
      first_month: "2026-09",
      last_month: "2026-11",
      months: 3,
      created_at: "2026-09-30T09:00:00+00:00",
      journal_no: 41,
      location: null,
      released: 1,
      released_amount: "33333",
      reversed: 0,
      due: 0,
      next_month: "2026-10",
      cancelled_at: null,
      cancel_reason: null,
    });
    expect(row).toMatchObject({
      amount: 100_000,
      months: 3,
      released: 1,
      releasedAmount: 33_333,
      reversed: 0,
      journalNo: 41,
      location: null,
      nextMonth: "2026-10",
      cancelledAt: null,
    });
    expect(stillAhead(row)).toBe(66_667);
    // Cancelled: its payment reversed, nothing of it is left in 1400.
    expect(stillAhead({ ...row, cancelledAt: "2026-09-30T10:00:00+00:00" })).toBe(0);
    // Every share posted: nothing left.
    expect(stillAhead({ ...row, released: 3, releasedAmount: 100_000, nextMonth: null })).toBe(0);
  });

  it("keeps 1400 off the screens' journals, bills and credits, as the database does", () => {
    const listed = (file: string, name: string) => {
      const src = readFileSync(join(__dirname, "..", file), "utf8");
      const body = new RegExp(`const ${name} = new Set\\(\\[([^\\]]*)\\]`).exec(src)?.[1] ?? "";
      return new Set([...body.matchAll(/"(\d{4})"/g)].map((m) => m[1]));
    };
    // The accounts the database takes no journal by hand on, as its latest migration leaves them.
    const latest = readdirSync(join(__dirname, "../supabase/migrations"))
      .filter((f) => f.endsWith(".sql"))
      .sort()
      .map((f) => readFileSync(join(__dirname, "../supabase/migrations", f), "utf8"))
      .filter((sql) => /function manual_journal_blocked/.test(sql))
      .pop()!;
    const blocked = new Set(
      [
        ...(
          /manual_journal_blocked[\s\S]*?select p_code in \(([^)]*)\)/.exec(latest)?.[1] ?? ""
        ).matchAll(/'(\d{4})'/g),
      ].map((m) => m[1]),
    );
    expect(["4000", "4100", "4200"].every((c) => blocked.has(c))).toBe(true);
    expect(blocked.has("1400")).toBe(true);
    expect(listed("src/app/journals/page.tsx", "BLOCKED")).toEqual(blocked);
    for (const list of ["NOT_FOR_BILLS", "NOT_FOR_CREDITS"])
      expect(listed("src/app/vendors/page.tsx", list).has("1400"), list).toBe(true);
  });

  it("names each prepaid expense recorded, released or cancelled on the audit trail", () => {
    for (const a of ["prepaid.record", "prepaid.release", "prepaid.cancel"]) {
      expect(migration).toContain(`'${a}'`);
      expect(actionLabel(a)).not.toBe(a);
    }
    expect(auditGroup("books")?.prefixes).toContain("prepaid.");
    const names = new Map<string, string>();
    const recorded = {
      description: "Shop rent, a quarter",
      amount: 300001,
      account: "6000",
      paid_from: "bank",
      first_month: "2026-09-01",
      months: 3,
      journal_no: 1101,
    };
    expect(subjectOf("prepaid_expense", "x", null, recorded, names)).toBe("Shop rent, a quarter");
    expect(describeChanges(null, recorded, names).map((c) => c.field)).toEqual([
      "Description",
      "Amount",
      "Account",
      "Paid from",
      "First month",
      "Months",
      "Journal",
    ]);
    const released = {
      released: [
        {
          prepaid_id: "0f0e0d0c-0b0a-0908-0706-050403020100",
          description: "Insurance, a year",
          month: "2026-10",
          amount: 10000,
          journal_no: 1102,
        },
        {
          prepaid_id: "1f0e0d0c-0b0a-0908-0706-050403020100",
          description: "Shop rent, a quarter",
          month: "2026-10",
          amount: 100000,
          journal_no: 1103,
        },
      ],
    };
    expect(subjectOf("prepaid_expense", null, null, released, names)).toBe("Prepaid expenses");
    expect(describeChanges(null, released, names)).toEqual([
      {
        field: "Shares posted",
        before: "",
        after: "Insurance, a year (2026-10): 10,000; Shop rent, a quarter (2026-10): 100,000",
      },
    ]);
    // Cancelled: by its words; which one it was is not a change anyone reads.
    const cancelled = {
      prepaid_id: "1f0e0d0c-0b0a-0908-0706-050403020100",
      description: "Shop rent, a quarter",
      shares_reversed: 1,
      journal_no: 1104,
    };
    expect(subjectOf("prepaid_expense", "x", null, cancelled, names)).toBe("Shop rent, a quarter");
    expect(describeChanges(null, cancelled, names).map((c) => c.field)).toEqual([
      "Description",
      "Shares reversed",
      "Journal",
    ]);
    expect(subjectOf("prepaid_expense", "x", null, {}, names)).toBe("A prepaid expense");
    const ar = translator(builtInWords("ar"));
    expect(subjectIn("A prepaid expense", "prepaid.cancel", ar, (s) => s)).toBe(
      ar("A prepaid expense"),
    );
    // Where the money came from, in the reader's words.
    const msg = messenger(builtInWords("ar"));
    expect(valueIn("bank", "Paid from", ar, msg)).toBe(msg("bank"));
    expect(msg("bank")).not.toBe("bank");
    for (const locale of ["ar", "ckb"] as const) {
      const words = builtInWords(locale);
      expect(
        [
          "Prepaid expense recorded",
          "Prepaid expenses' shares posted",
          "Prepaid expense cancelled",
          "A prepaid expense",
          "Prepaid expenses",
          "First month",
          "Months",
          "Shares posted",
          "Shares reversed",
          "Prepaid expenses due",
        ].filter((p) => !words[p]),
        locale,
      ).toEqual([]);
    }
  });
});

describe("a payment like one posted already, asked about first (the September audit's P2-14)", () => {
  const rent = {
    accountCode: "6000",
    amount: 150_000,
    date: "2026-09-24",
    journalNo: 1012,
    description: "Shop rent",
  };

  it("finds one to the same account, for the same amount, within three days", () => {
    expect(SAME_PAYMENT_DAYS).toBe(3);
    const ask = (p: Partial<{ accountCode: string; amount: number; date: string }>) =>
      samePayments([rent], { accountCode: "6000", amount: 150_000, date: "2026-09-24", ...p });
    expect(ask({})).toEqual([rent]);
    expect(ask({ date: "2026-09-27" })).toEqual([rent]);
    expect(ask({ date: "2026-09-21" })).toEqual([rent]);
    // Four days apart, another account or another amount: another payment.
    expect(ask({ date: "2026-09-28" })).toEqual([]);
    expect(ask({ accountCode: "6200" })).toEqual([]);
    expect(ask({ amount: 150_250 })).toEqual([]);
    // Nothing asked before the form is filled in.
    expect(ask({ accountCode: "" })).toEqual([]);
    expect(ask({ amount: 0 })).toEqual([]);
    expect(ask({ date: "" })).toEqual([]);
  });

  it("reads what was posted: an expense not reversed, a prepaid expense not cancelled, on its day", () => {
    const posted = postedPayments(
      [
        { ...rent, reversedBy: null },
        { ...rent, journalNo: 1013, reversedBy: 1014 },
        { ...rent, accountCode: "", journalNo: 1015, reversedBy: null },
      ],
      [
        {
          accountCode: "6900",
          amount: 120_000,
          // 21:30 UTC on the 29th is already the 30th in Baghdad: the café's day counts.
          createdAt: "2026-09-29T21:30:00Z",
          journalNo: 1020,
          description: "Insurance, a year",
          cancelledAt: null,
        },
        {
          accountCode: "6900",
          amount: 120_000,
          createdAt: "2026-09-29T21:30:00Z",
          journalNo: 1021,
          description: "Insurance, entered twice",
          cancelledAt: "2026-09-29T22:00:00Z",
        },
      ],
      "Asia/Baghdad",
    );
    expect(posted.map((p) => [p.journalNo, p.date])).toEqual([
      [1012, "2026-09-24"],
      [1020, "2026-09-30"],
    ]);
    // A prepaid expense recorded again two days on is asked about.
    expect(
      samePayments(posted, { accountCode: "6900", amount: 120_000, date: "2026-10-01" }).map(
        (p) => p.journalNo,
      ),
    ).toEqual([1020]);
  });

  it("reads the payments like it the database answers with instead of posting (0061)", () => {
    expect(sameFromServer({ expense_id: "e", journal_no: 1013 })).toBeNull();
    expect(
      sameFromServer({
        same: [
          {
            account_code: "6000",
            amount: 150000,
            date: "2026-09-24",
            journal_no: 1012,
            description: "Shop rent",
          },
        ],
        // Sent again with its key: the first answer, given back.
        replayed: true,
      }),
    ).toEqual([rent]);
  });

  it("asks in Arabic and Kurdish", () => {
    for (const locale of ["ar", "ckb"] as const) {
      const words = builtInWords(locale);
      expect(
        [
          SAME_PAYMENT,
          "A payment like this one is posted already:",
          "It is another payment, not the same one",
        ].filter((p) => !words[p]),
        locale,
      ).toEqual([]);
    }
  });
});

describe("what a review of the releases since 0035 found, put right (0063–0066)", () => {
  const read = (path: string) => readFileSync(join(__dirname, "..", path), "utf8");

  it("the till lists its own branch's bills after a change, as its page does", () => {
    // Every read of the open bills names the branch: without it, a till showed
    // every branch's, and took one's payment into its own drawer.
    for (const file of ["src/lib/actions/pos.ts", "src/lib/db/pos.ts"]) {
      const calls = read(file).match(/"pos_open_bills"[^)]*\)/g) ?? [];
      expect([file, calls.length > 0]).toEqual([file, true]);
      for (const call of calls)
        expect([file, call]).toEqual([file, expect.stringContaining("p_location")]);
    }
    // The branch is the one the till's page lists: tillChoice's.
    expect(read("src/lib/actions/pos.ts")).toMatch(
      /const \{ at \} = await tillChoice\(\);\s+const r = await callRpc<unknown>\("pos_open_bills", \{ p_location: at \}\)/,
    );
  });

  it("someone who works at one place sends to any of the café's places", () => {
    const page = read("src/app/inventory/transfers/page.tsx");
    // Whether the café has a second place is the café's, not this person's.
    expect(page).toContain("getCafePlaces()");
    expect(page).toMatch(/\{cafe\.length < 2 \?/);
    expect(page).toMatch(/destinations=\{cafe\.map\(/);
    expect(page).toContain("worksAt={profile.worksAt}");
    const form = read("src/components/inventory/Transfers.tsx");
    // Sent from where they work, to any other of the café's places.
    expect(form).toMatch(/\{destinations\s+\.filter\(\(p\) => p\.id !== from\)/);
    expect(form).toMatch(/\{places\.map\(\(p\) => \(\s+<option/);
    // Received where it goes, cancelled where it was sent from: as the database checks.
    expect(form).toContain("mayReceive={worksAt === null || worksAt === x.toId}");
    expect(form).toContain("mayCancel={worksAt === null || worksAt === x.fromId}");
  });

  it("the journals of salaries and advances name no one, and read in each language", () => {
    const migration = read("supabase/migrations/0064_review_fixes_payroll_till.sql");
    expect(migration).toContain(
      "'Salaries ' || payroll_month_text(r.month) || ' (payroll ' || r.run_no || ')'",
    );
    expect(migration).toContain("post_journal(v_business, now(), 'Advance on pay',");
    for (const locale of ["ar", "ckb"] as const) {
      const msg = messenger(builtInWords(locale));
      const said = msg("Salaries 2026-09 (payroll 3)");
      expect([
        locale,
        said.includes("2026-09") && said.includes("3"),
        said === "Salaries 2026-09 (payroll 3)",
      ]).toEqual([locale, true, false]);
      expect([locale, msg("Advance on pay") === "Advance on pay"]).toEqual([locale, false]);
    }
  });

  it("says each new refusal in Arabic and Kurdish", () => {
    const refusals = [
      "Golden milk was counted after that time: a batch made before the count is in it already, and is not recorded now",
      "Golden beans was counted since the loss, and the count put its stock right: approve the loss instead",
      "Second Manager works at Second Branch, not here: choose someone who works here",
      "This leaves Golden cup below zero, which a manager approves: ask one to send it",
      "This leaves Golden cup below zero, which a manager approves: ask one to return it",
      "Delivery 4 came on 2026-10-01: date its bill that day or later",
      "Money from the till or the safe is recorded the day it is taken out: today",
      "A journal that moved the till's or the safe's cash is reversed today, when they count it",
    ];
    for (const locale of ["ar", "ckb"] as const) {
      const msg = messenger(builtInWords(locale));
      for (const r of refusals)
        expect([
          locale,
          r,
          /[A-Za-z]{4,}/.test(msg(r).replace(/Golden \w+|Second \w+|\d{4}-\d{2}-\d{2}/g, "")),
        ]).toEqual([locale, r, false]);
    }
  });
});
