/**
 * The sales analysis, the stock's value on a day, and what was bought (0051,
 * release Y): the ways the sales are seen, the shapes the screens read, and
 * the words they give them. Pure: the pages, the CSV and the tests read
 * through here.
 */

/** Each way the sales are seen, in the order the screen offers them. */
export const SALES_DIMENSIONS = [
  { key: "hour", label: "Hour" },
  { key: "weekday", label: "Day of the week" },
  { key: "date", label: "Date" },
  { key: "product", label: "Product" },
  { key: "category", label: "Category" },
  { key: "size", label: "Size" },
  { key: "addon", label: "Add-on" },
  { key: "employee", label: "Who took the money" },
  { key: "payment", label: "Payment" },
  { key: "channel", label: "Channel" },
  { key: "branch", label: "Branch" },
] as const;

export type SalesDimension = (typeof SALES_DIMENSIONS)[number]["key"];

const DIMENSION_KEYS = new Set<string>(SALES_DIMENSIONS.map((d) => d.key));

export function isSalesDimension(v: unknown): v is SalesDimension {
  return typeof v === "string" && DIMENSION_KEYS.has(v);
}

export function dimensionLabel(d: SalesDimension): string {
  return SALES_DIMENSIONS.find((x) => x.key === d)?.label ?? d;
}

/** The ways that follow a sale's lines: a payment pays for the whole sale. */
const LINE_DIMENSIONS = new Set<SalesDimension>(["product", "category", "size", "addon"]);
/** The ways kept in their own order, not the most first. */
export const TIME_DIMENSIONS = new Set<SalesDimension>(["hour", "weekday", "date"]);

export type AnalysisGrain = "line" | "addon" | "payment";

/** What the rows are: the lines sold, the add-ons, or the payments. */
export function analysisGrain(by: SalesDimension, then: SalesDimension | null): AnalysisGrain {
  if (by === "payment" || then === "payment") return "payment";
  if (by === "addon" || then === "addon") return "addon";
  return "line";
}

/**
 * Why a choice cannot be shown, as the database would refuse it, or null:
 * the same way twice, or payments with the lines or a category.
 */
export function analysisProblem(
  by: SalesDimension,
  then: SalesDimension | null,
  category: string | null,
): string | null {
  if (then === by) return "Choose something else to see them by next";
  if (
    analysisGrain(by, then) === "payment" &&
    (LINE_DIMENSIONS.has(by) || (then !== null && LINE_DIMENSIONS.has(then)) || category)
  )
    return "A payment pays for a whole sale: see the payments by the hour, the day, the person, the channel or the branch";
  return null;
}

/** The café's week, from Saturday: the weekday's key is its place in it. */
export const WEEKDAYS = [
  "Saturday",
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
] as const;

/** A name in the three languages; the screen picks the viewer's. */
export interface Names {
  en: string;
  ar?: string;
  ckb?: string;
}

export function namesIn(n: Names, locale: string): string {
  if (locale === "ar" && n.ar) return n.ar;
  if (locale === "ckb" && n.ckb) return n.ckb;
  return n.en;
}

/** The figures of a row, or of all of them; each grain fills its own. */
export interface AnalysisFigures {
  orders: number;
  /** Items sold (the lines), or add-ons taken. */
  qty: number;
  gross: number;
  discount: number;
  net: number;
  cost: number;
  margin: number;
  /** What refunds gave back of these sales since, and the cost they put back. */
  refunded: number;
  costBack: number;
  kept: number;
  marginKept: number;
  /** Add-ons: the lines they were taken on. */
  lines: number;
  /** Payments: what each way took. */
  paid: number;
}

export interface AnalysisRow extends AnalysisFigures {
  key: string;
  names: Names;
  key2: string | null;
  names2: Names | null;
}

export interface SalesAnalysis {
  from: string;
  to: string;
  by: SalesDimension;
  then: SalesDimension | null;
  grain: AnalysisGrain;
  rows: AnalysisRow[];
  rowCount: number;
  truncated: boolean;
  total: AnalysisFigures;
  voided: { orders: number; net: number };
  cancelledBills: number;
  choices: {
    people: { id: string; name: string }[];
    categories: { id: string; names: Names }[];
    branches: { id: string; name: string }[];
  };
}

function figuresFrom(o: Record<string, unknown>): AnalysisFigures {
  return {
    orders: num(o.orders),
    qty: num(o.qty),
    gross: num(o.gross),
    discount: num(o.discount),
    net: num(o.net),
    cost: num(o.cost),
    margin: num(o.margin),
    refunded: num(o.refunded),
    costBack: num(o.cost_back),
    kept: num(o.kept),
    marginKept: num(o.margin_kept),
    lines: num(o.lines),
    paid: num(o.paid),
  };
}

function namesFrom(v: unknown, fallback: string): Names {
  const o = obj(v);
  const en = strOrNull(o.en) ?? fallback;
  const n: Names = { en };
  const ar = strOrNull(o.ar);
  const ckb = strOrNull(o.ckb);
  if (ar) n.ar = ar;
  if (ckb) n.ckb = ckb;
  return n;
}

export function salesAnalysisFrom(v: unknown): SalesAnalysis {
  const o = obj(v);
  const by = isSalesDimension(o.by) ? o.by : "product";
  const then = isSalesDimension(o.then) ? o.then : null;
  const grain = o.grain === "addon" || o.grain === "payment" ? o.grain : "line";
  const c = obj(o.choices);
  return {
    from: str(o.from),
    to: str(o.to),
    by,
    then,
    grain,
    rows: list(o.rows).map((r) => ({
      ...figuresFrom(r),
      key: str(r.key),
      names: namesFrom(r.names, str(r.key)),
      key2: strOrNull(r.key2),
      names2: then ? namesFrom(r.names2, str(r.key2)) : null,
    })),
    rowCount: num(o.row_count),
    truncated: o.truncated === true,
    total: figuresFrom(obj(o.total)),
    voided: { orders: num(obj(o.voided).orders), net: num(obj(o.voided).net) },
    cancelledBills: num(o.cancelled_bills),
    choices: {
      people: list(c.people).map((p) => ({ id: str(p.id), name: str(p.name) })),
      categories: list(c.categories).map((p) => ({
        id: str(p.id),
        names: namesFrom(p.names, str(p.id)),
      })),
      branches: list(c.branches).map((p) => ({ id: str(p.id), name: str(p.name) })),
    },
  };
}

/**
 * A row's name as the screen shows it, before translation: the hour as
 * "08:00", the weekday and the payment as their phrase, the channel through
 * its own names, and the rest as the database named it, in the viewer's
 * language when it has one.
 */
export function rowName(
  dim: SalesDimension,
  key: string,
  names: Names,
  locale: string,
  channelName: (code: string) => string,
): { text: string; phrase: boolean } {
  switch (dim) {
    case "hour":
      return { text: `${key.padStart(2, "0")}:00`, phrase: false };
    case "weekday":
      return { text: WEEKDAYS[Number(key)] ?? key, phrase: true };
    case "payment":
      return { text: PAYMENT_LABEL[key] ?? key, phrase: PAYMENT_LABEL[key] !== undefined };
    case "channel":
      return { text: channelName(key), phrase: false };
    case "category":
      return key === "none"
        ? { text: "No category", phrase: true }
        : { text: namesIn(names, locale), phrase: false };
    case "employee":
      return key === "none"
        ? { text: "No one", phrase: true }
        : { text: namesIn(names, locale), phrase: false };
    default:
      return { text: namesIn(names, locale), phrase: false };
  }
}

const PAYMENT_LABEL: Record<string, string> = {
  cash: "Cash",
  card: "Card",
  platform_paid: "Platform-paid",
  mixed: "Mixed",
  // The café's own ways to pay (0069), together: Reports → Payments has each.
  other: "Other ways to pay",
};

/** A share of the most in the list, for the bar beside a row (0–100). */
export function barWidth(value: number, most: number): number {
  if (!(most > 0) || !(value > 0)) return 0;
  return Math.max(1, Math.min(100, Math.round((value / most) * 100)));
}

/** The stock's value at the end of a day (0051). */
export interface StockValue {
  asOf: string;
  location: string | null;
  items: {
    itemId: string;
    name: string;
    nameAr: string | null;
    nameCkb: string | null;
    type: string;
    unit: string;
    qty: number;
    value: number;
    unitCost: number | null;
  }[];
  byType: { type: string; items: number; value: number }[];
  stock: number;
  /** What 1200 held then: only for the whole café. */
  ledger: number | null;
  difference: number | null;
}

export function stockValueFrom(v: unknown): StockValue {
  const o = obj(v);
  return {
    asOf: str(o.as_of),
    location: strOrNull(o.location),
    items: list(o.items).map((i) => ({
      itemId: str(i.item_id),
      name: str(i.name),
      nameAr: strOrNull(i.name_ar),
      nameCkb: strOrNull(i.name_ckb),
      type: str(i.type),
      unit: str(i.unit),
      qty: num(i.qty),
      value: num(i.value),
      unitCost: numOrNull(i.unit_cost),
    })),
    byType: list(o.by_type).map((x) => ({
      type: str(x.type),
      items: num(x.items),
      value: num(x.value),
    })),
    stock: num(o.stock),
    ledger: numOrNull(o.ledger),
    difference: numOrNull(o.difference),
  };
}

/** What was bought in the dates, by supplier and by item (0051). */
export interface Purchases {
  from: string;
  to: string;
  suppliers: {
    supplierId: string;
    name: string;
    deliveries: number;
    received: number;
    returned: number;
    priceCredits: number;
    net: number;
    bills: number;
    billed: number;
  }[];
  items: {
    itemId: string;
    name: string;
    nameAr: string | null;
    nameCkb: string | null;
    unit: string;
    qty: number;
    received: number;
    unitCost: number | null;
    suppliers: number;
    qtyBack: number;
    returned: number;
    net: number;
  }[];
  total: {
    deliveries: number;
    received: number;
    returns: number;
    returned: number;
    priceCredits: number;
    net: number;
    bills: number;
    billed: number;
  };
}

export function purchasesFrom(v: unknown): Purchases {
  const o = obj(v);
  const t = obj(o.total);
  return {
    from: str(o.from),
    to: str(o.to),
    suppliers: list(o.suppliers).map((s) => ({
      supplierId: str(s.supplier_id),
      name: str(s.name),
      deliveries: num(s.deliveries),
      received: num(s.received),
      returned: num(s.returned),
      priceCredits: num(s.price_credits),
      net: num(s.net),
      bills: num(s.bills),
      billed: num(s.billed),
    })),
    items: list(o.items).map((i) => ({
      itemId: str(i.item_id),
      name: str(i.name),
      nameAr: strOrNull(i.name_ar),
      nameCkb: strOrNull(i.name_ckb),
      unit: str(i.unit),
      qty: num(i.qty),
      received: num(i.received),
      unitCost: numOrNull(i.unit_cost),
      suppliers: num(i.suppliers),
      qtyBack: num(i.qty_back),
      returned: num(i.returned),
      net: num(i.net),
    })),
    total: {
      deliveries: num(t.deliveries),
      received: num(t.received),
      returns: num(t.returns),
      returned: num(t.returned),
      priceCredits: num(t.price_credits),
      net: num(t.net),
      bills: num(t.bills),
      billed: num(t.billed),
    },
  };
}

/** A name in the viewer's language, from a record's three. */
export function itemNameIn(
  i: { name: string; nameAr: string | null; nameCkb: string | null },
  locale: string,
): string {
  if (locale === "ar" && i.nameAr) return i.nameAr;
  if (locale === "ckb" && i.nameCkb) return i.nameCkb;
  return i.name;
}

/** Every word this file gives a screen: each is a phrase in the books. */
export const ANALYSIS_PHRASES: readonly string[] = [
  ...SALES_DIMENSIONS.map((d) => d.label),
  ...WEEKDAYS,
  ...Object.values(PAYMENT_LABEL),
  "No category",
  "No one",
];

const num = (v: unknown): number => {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const numOrNull = (v: unknown): number | null =>
  v === null || v === undefined || v === "" ? null : num(v);
const str = (v: unknown): string => (v === null || v === undefined ? "" : String(v));
const strOrNull = (v: unknown): string | null =>
  v === null || v === undefined || v === "" ? null : String(v);
const list = (v: unknown): Record<string, unknown>[] =>
  Array.isArray(v) ? (v as Record<string, unknown>[]) : [];
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
