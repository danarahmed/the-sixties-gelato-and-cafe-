/**
 * Expanded in-memory demonstration dataset that powers the module screens.
 * Everything here is EXAMPLE data. Where a figure can be computed, it is
 * computed with the real tested domain core (costing, recipe expansion,
 * settlement reconciliation) rather than hard-coded — so the screens show the
 * engine working, not mock numbers.
 */
import { IQD, Money } from "@domain/money/money.js";
import { averageUnitCost } from "@domain/costing/wac.js";
import { expandRecipeForSale, recipeServingCost, type SalesChannel } from "@domain/sales/recipe.js";
import {
  computePlatformPayout,
  computeChannelContribution,
  reconcileSettlement,
  type PlatformOrderEconomics,
  type ExpectedOrderRecord,
  type SettlementLine,
} from "@domain/platform/settlement.js";
import {
  DEMO_PRODUCTS,
  DEMO_RECIPES,
  resolverContext,
  wacByItem,
  itemName,
  type DemoProduct,
} from "./catalog.js";

export const iqd = (v: number | string) => Money.of(v, IQD);
export const fmt = (m: Money) => m.format();

// ---------------------------------------------------------------------------
// Inventory: stock on hand (would be derived from the ledger in the live app)
// ---------------------------------------------------------------------------
export interface StockRow {
  itemId: string;
  name: string;
  category: "Ingredient" | "Packaging" | "Consumable" | "Finished good" | "Resale";
  unit: string;
  onHandBase: number;
  reorderBase: number;
  parBase: number;
  unitCost: number;
  expiry?: string;
}

export const INVENTORY: StockRow[] = [
  {
    itemId: "coffee_beans",
    name: "Coffee beans",
    category: "Ingredient",
    unit: "g",
    onHandBase: 18560,
    reorderBase: 5000,
    parBase: 20000,
    unitCost: 40,
  },
  {
    itemId: "milk",
    name: "Milk",
    category: "Ingredient",
    unit: "ml",
    onHandBase: 57000,
    reorderBase: 20000,
    parBase: 60000,
    unitCost: 2,
    expiry: "2026-08-25",
  },
  {
    itemId: "vanilla_syrup",
    name: "Vanilla syrup",
    category: "Ingredient",
    unit: "ml",
    onHandBase: 4400,
    reorderBase: 2000,
    parBase: 5000,
    unitCost: 5,
  },
  {
    itemId: "gelato_pistachio",
    name: "Pistachio gelato",
    category: "Finished good",
    unit: "g",
    onHandBase: 1730,
    reorderBase: 1500,
    parBase: 5000,
    unitCost: 3.8125,
    expiry: "2026-08-20",
  },
  {
    itemId: "cup_takeaway",
    name: "Takeaway cup",
    category: "Packaging",
    unit: "each",
    onHandBase: 1860,
    reorderBase: 500,
    parBase: 2000,
    unitCost: 100,
  },
  {
    itemId: "lid",
    name: "Cup lid",
    category: "Packaging",
    unit: "each",
    onHandBase: 1920,
    reorderBase: 500,
    parBase: 2000,
    unitCost: 50,
  },
  {
    itemId: "straw",
    name: "Straw",
    category: "Consumable",
    unit: "each",
    onHandBase: 9979,
    reorderBase: 2000,
    parBase: 5000,
    unitCost: 20,
  },
  {
    itemId: "gelato_cup",
    name: "Gelato cup",
    category: "Packaging",
    unit: "each",
    onHandBase: 640,
    reorderBase: 500,
    parBase: 1000,
    unitCost: 120,
  },
  {
    itemId: "gelato_spoon",
    name: "Gelato spoon",
    category: "Consumable",
    unit: "each",
    onHandBase: 4870,
    reorderBase: 1000,
    parBase: 5000,
    unitCost: 15,
  },
  {
    itemId: "napkin",
    name: "Napkin",
    category: "Consumable",
    unit: "each",
    onHandBase: 9740,
    reorderBase: 3000,
    parBase: 10000,
    unitCost: 10,
  },
  {
    itemId: "delivery_bag",
    name: "Delivery bag",
    category: "Packaging",
    unit: "each",
    onHandBase: 420,
    reorderBase: 500,
    parBase: 1000,
    unitCost: 150,
  },
  {
    itemId: "sticker",
    name: "Sticker",
    category: "Consumable",
    unit: "each",
    onHandBase: 2960,
    reorderBase: 1000,
    parBase: 3000,
    unitCost: 30,
  },
  {
    itemId: "tamper_seal",
    name: "Tamper seal",
    category: "Consumable",
    unit: "each",
    onHandBase: 2960,
    reorderBase: 1000,
    parBase: 3000,
    unitCost: 40,
  },
  {
    itemId: "carrier",
    name: "Drink carrier",
    category: "Packaging",
    unit: "each",
    onHandBase: 470,
    reorderBase: 500,
    parBase: 1000,
    unitCost: 200,
  },
];

export interface StockStatus extends StockRow {
  value: number;
  low: boolean;
  expiringSoon: boolean;
}

export function stockStatus(today = "2026-08-23"): StockStatus[] {
  return INVENTORY.map((r) => {
    const expiringSoon = r.expiry ? daysBetween(today, r.expiry) <= 3 : false;
    return {
      ...r,
      value: r.onHandBase * r.unitCost,
      low: r.onHandBase < r.reorderBase,
      expiringSoon,
    };
  });
}

function daysBetween(a: string, b: string): number {
  const da = Date.parse(a + "T00:00:00Z");
  const db = Date.parse(b + "T00:00:00Z");
  return Math.round((db - da) / 86400000);
}

// ---------------------------------------------------------------------------
// Orders: a handful across channels, COGS computed via the recipe engine
// ---------------------------------------------------------------------------
export interface DemoOrder {
  id: string;
  time: string;
  channel: SalesChannel;
  productId: string;
  qty: number;
  tender: "cash" | "card" | "platform_paid";
}

export const ORDERS: DemoOrder[] = [
  {
    id: "S-1042",
    time: "11:02",
    channel: "dine_in",
    productId: "iced_latte",
    qty: 1,
    tender: "cash",
  },
  {
    id: "S-1043",
    time: "11:18",
    channel: "takeaway",
    productId: "gelato_cup_pistachio",
    qty: 2,
    tender: "card",
  },
  {
    id: "S-1044",
    time: "11:35",
    channel: "takeaway",
    productId: "iced_latte",
    qty: 1,
    tender: "cash",
  },
  {
    id: "S-1045",
    time: "12:07",
    channel: "talabat",
    productId: "iced_latte",
    qty: 1,
    tender: "platform_paid",
  },
  {
    id: "S-1046",
    time: "12:40",
    channel: "dine_in",
    productId: "gelato_cup_pistachio",
    qty: 1,
    tender: "cash",
  },
];

export function productById(id: string): DemoProduct {
  const p = DEMO_PRODUCTS.find((x) => x.id === id);
  if (!p) throw new Error(`Unknown product ${id}`);
  return p;
}

export interface OrderComputed {
  order: DemoOrder;
  productName: string;
  price: Money;
  net: Money;
  cogs: Money;
  margin: Money;
  marginPct: string;
}

export function computeOrder(o: DemoOrder): OrderComputed {
  const p = productById(o.productId);
  const recipe = DEMO_RECIPES[p.recipeId]!;
  const price = iqd(p.price[o.channel] ?? 0).multiply(o.qty);
  const unitCogs = recipeServingCost(recipe, o.channel, resolverContext, wacByItem, IQD);
  const cogs = unitCogs.multiply(o.qty);
  const margin = price.subtract(cogs);
  const marginPct = price.isPositive()
    ? margin
        .toDecimalValue()
        .dividedBy(price.toDecimalValue())
        .times(100)
        .toDecimalPlaces(1)
        .toString()
    : "0";
  return {
    order: o,
    productName: p.name,
    price: price.quantize(),
    net: price.quantize(),
    cogs: cogs.quantize(),
    margin: margin.quantize(),
    marginPct,
  };
}

export function ordersComputed(): OrderComputed[] {
  return ORDERS.map(computeOrder);
}

export function orderDeductions(
  o: DemoOrder,
): { itemId: string; name: string; qty: string; cost: Money }[] {
  const p = productById(o.productId);
  const recipe = DEMO_RECIPES[p.recipeId]!;
  return expandRecipeForSale(recipe, o.channel, o.qty, resolverContext).map((d) => ({
    itemId: d.itemId,
    name: itemName(d.itemId),
    qty: d.baseQuantity.toString(),
    cost: averageUnitCost(wacByItem.get(d.itemId)!).multiply(d.baseQuantity).quantize(),
  }));
}

// ---------------------------------------------------------------------------
// Reports: product margin + channel margin, computed live
// ---------------------------------------------------------------------------
export const CHANNELS: SalesChannel[] = ["dine_in", "takeaway", "direct_delivery", "talabat"];

export function productMargin(): {
  name: string;
  channel: SalesChannel;
  price: Money;
  cost: Money;
  margin: Money;
  pct: string;
}[] {
  const rows: {
    name: string;
    channel: SalesChannel;
    price: Money;
    cost: Money;
    margin: Money;
    pct: string;
  }[] = [];
  for (const p of DEMO_PRODUCTS) {
    const recipe = DEMO_RECIPES[p.recipeId]!;
    for (const ch of CHANNELS) {
      const price = iqd(p.price[ch] ?? 0);
      const cost = recipeServingCost(recipe, ch, resolverContext, wacByItem, IQD);
      const margin = price.subtract(cost);
      const pct = price.isPositive()
        ? margin
            .toDecimalValue()
            .dividedBy(price.toDecimalValue())
            .times(100)
            .toDecimalPlaces(1)
            .toString()
        : "0";
      rows.push({
        name: p.name,
        channel: ch,
        price: price.quantize(),
        cost: cost.quantize(),
        margin: margin.quantize(),
        pct,
      });
    }
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Platform settlement scenario (mirrors acceptance scenario 4 + a discrepancy)
// ---------------------------------------------------------------------------
export const TALABAT_ORDER: PlatformOrderEconomics = {
  currency: IQD,
  merchantListValue: iqd(6000),
  merchantFundedDiscount: iqd(500),
  platformFundedDiscount: iqd(500),
  commission: iqd(1100),
  paymentProcessingFee: iqd(150),
  serviceFee: iqd(0),
  advertisingFee: iqd(100),
  deliveryFeeChargedToMerchant: iqd(0),
  refunds: iqd(500),
  otherAdjustments: iqd(0),
};

export function talabatPayout() {
  const payout = computePlatformPayout(TALABAT_ORDER);
  const cogs = recipeServingCost(
    DEMO_RECIPES["iced_latte"]!,
    "talabat",
    resolverContext,
    wacByItem,
    IQD,
  );
  const contribution = computeChannelContribution(TALABAT_ORDER, cogs);
  return { payout, cogs: cogs.quantize(), contribution };
}

export function settlementReport() {
  const { payout } = talabatPayout();
  const expected: ExpectedOrderRecord[] = [
    {
      externalOrderId: "TLB-2026-0001",
      status: "completed",
      expectedPayout: payout.expectedPayout,
      commission: iqd(1100),
    },
    {
      externalOrderId: "TLB-2026-0002",
      status: "completed",
      expectedPayout: iqd(4200),
      commission: iqd(950),
    },
  ];
  const settlement: SettlementLine[] = [
    // Order 1: short payout + overcharged commission (both flagged).
    {
      externalOrderId: "TLB-2026-0001",
      reportedPayout: iqd(3450),
      reportedCommission: iqd(1300),
      adjustmentNote: "Fee adjustment",
    },
    // Order 2 is missing from the statement entirely.
  ];
  return { report: reconcileSettlement(expected, settlement, IQD), expected, settlement };
}

// ---------------------------------------------------------------------------
// Accounting: chart of accounts + a computed day P&L
// ---------------------------------------------------------------------------
export interface PnlLine {
  label: string;
  amount: Money;
  kind: "revenue" | "cost" | "subtotal";
}

export function dayPnl(): PnlLine[] {
  const orders = ordersComputed();
  const grossSales = Money.sum(
    orders.map((o) => o.net),
    IQD,
  );
  const cogs = Money.sum(
    orders.map((o) => o.cogs),
    IQD,
  );
  const grossProfit = grossSales.subtract(cogs);
  // Platform fees for the one Talabat order (illustrative).
  const { payout } = talabatPayout();
  const platformFees = payout.totalPlatformFees;
  const contribution = grossProfit.subtract(platformFees);
  return [
    { label: "Gross sales", amount: grossSales.quantize(), kind: "revenue" },
    { label: "Cost of goods sold", amount: cogs.quantize(), kind: "cost" },
    { label: "Gross profit", amount: grossProfit.quantize(), kind: "subtotal" },
    { label: "Platform commissions & fees", amount: platformFees.quantize(), kind: "cost" },
    { label: "Contribution profit", amount: contribution.quantize(), kind: "subtotal" },
  ];
}

export const CHART_OF_ACCOUNTS = [
  { code: "1000", name: "Cash on hand", type: "Asset" },
  { code: "1100", name: "Platform receivable", type: "Asset" },
  { code: "1200", name: "Inventory", type: "Asset" },
  { code: "2000", name: "Accounts payable", type: "Liability" },
  { code: "4000", name: "Sales revenue", type: "Revenue" },
  { code: "5000", name: "Cost of goods sold", type: "Expense" },
  { code: "5100", name: "Platform commission", type: "Expense" },
  { code: "5300", name: "Waste & spoilage", type: "Expense" },
  { code: "6000", name: "Rent", type: "Expense" },
];

export const SAMPLE_JOURNAL = {
  id: "JE-1044",
  description: "Cash sale S-1044 (takeaway iced latte)",
  lines: [
    { account: "1000 Cash on hand", debit: 4000, credit: 0 },
    { account: "4000 Sales revenue", debit: 0, credit: 4000 },
    { account: "5000 Cost of goods sold", debit: 1470, credit: 0 },
    { account: "1200 Inventory", debit: 0, credit: 1470 },
  ],
};

export const channelLabel: Record<SalesChannel, string> = {
  dine_in: "Dine-in",
  takeaway: "Takeaway",
  direct_delivery: "Direct delivery",
  talabat: "Talabat",
  careem: "Careem",
  toters: "Toters",
};
