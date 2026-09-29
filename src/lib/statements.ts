/**
 * The balance sheet and the cash-flow statement (0052, release Z), as the
 * database gives them, and the rows the screen shows. Pure: the database
 * works the figures out; this reads them and lays them out.
 */

/** Where an account sits on the balance sheet. */
export type BalanceGroup = "cash" | "current" | "fixed" | "liability" | "equity";

export interface BalanceLine {
  code: string;
  name: string;
  section: string;
  group: BalanceGroup;
  amount: number;
}

/** What the café owned and owed when a day ended (report_balance_sheet). */
export interface BalanceSheet {
  asOf: string;
  yearFrom: string;
  lines: BalanceLine[];
  cash: number;
  currentAssets: number;
  fixedAssets: number;
  assets: number;
  liabilities: number;
  equity: number;
  profitThisYear: number;
  profitEarlier: number;
  equityTotal: number;
  liabilitiesAndEquity: number;
  difference: number;
}

const GROUPS: readonly BalanceGroup[] = ["cash", "current", "fixed", "liability", "equity"];
const isGroup = (v: unknown): v is BalanceGroup =>
  typeof v === "string" && (GROUPS as readonly string[]).includes(v);

export function balanceSheetFrom(v: unknown): BalanceSheet {
  const o = obj(v);
  return {
    asOf: str(o.as_of),
    yearFrom: str(o.year_from),
    lines: list(o.lines).map((l) => ({
      code: str(l.code),
      name: str(l.name),
      section: str(l.section),
      group: isGroup(l.group) ? l.group : "current",
      amount: num(l.amount),
    })),
    cash: num(o.cash),
    currentAssets: num(o.current_assets),
    fixedAssets: num(o.fixed_assets),
    assets: num(o.assets),
    liabilities: num(o.liabilities),
    equity: num(o.equity),
    profitThisYear: num(o.profit_this_year),
    profitEarlier: num(o.profit_earlier),
    equityTotal: num(o.equity_total),
    liabilitiesAndEquity: num(o.liabilities_and_equity),
    difference: num(o.difference),
  };
}

/** One account on the balance sheet, at the start of the dates and at their end. */
export interface BalanceRow {
  code: string;
  name: string;
  start: number;
  end: number;
}

/**
 * The two balance sheets side by side, group by group: every account either
 * holds, in the chart's order, nought where one of them has none.
 */
export function balanceRows(
  start: BalanceSheet,
  end: BalanceSheet,
): Record<BalanceGroup, BalanceRow[]> {
  const rows = new Map<string, BalanceRow & { group: BalanceGroup }>();
  for (const [side, sheet] of [
    ["start", start],
    ["end", end],
  ] as const) {
    for (const l of sheet.lines) {
      const r = rows.get(l.code) ?? {
        code: l.code,
        name: l.name,
        group: l.group,
        start: 0,
        end: 0,
      };
      r[side] = l.amount;
      rows.set(l.code, r);
    }
  }
  const out: Record<BalanceGroup, BalanceRow[]> = {
    cash: [],
    current: [],
    fixed: [],
    liability: [],
    equity: [],
  };
  for (const r of [...rows.values()].sort((a, b) => a.code.localeCompare(b.code))) {
    out[r.group].push({ code: r.code, name: r.name, start: r.start, end: r.end });
  }
  return out;
}

/** The lines of the cash-flow statement, in their order, each in its section. */
export type CashFlowSection = "operating" | "investing" | "financing" | "exchange";

export const CASH_FLOW_SECTIONS: readonly { key: CashFlowSection; label: string }[] = [
  { key: "operating", label: "From running the café" },
  { key: "investing", label: "Invested in equipment" },
  { key: "financing", label: "From and to the owner" },
  { key: "exchange", label: "From changing dollars" },
];

export const CASH_FLOW_LINES: readonly { key: string; section: CashFlowSection; label: string }[] =
  [
    { key: "sales", section: "operating", label: "Received from sales" },
    { key: "stock", section: "operating", label: "Paid for stock and to suppliers" },
    { key: "staff", section: "operating", label: "Paid to staff, and advances" },
    { key: "running", section: "operating", label: "Running costs" },
    { key: "counts", section: "operating", label: "The drawer counted over or short" },
    { key: "equipment", section: "investing", label: "Equipment bought or sold" },
    { key: "owner", section: "financing", label: "The owner's money in and out" },
    {
      key: "exchange",
      section: "exchange",
      label: "Dollars changed at another rate than they were kept at",
    },
  ];

/** A line's words on the screen: its label, or its key when the database adds one. */
export function cashFlowLabel(line: string): { text: string; phrase: boolean } {
  const known = CASH_FLOW_LINES.find((l) => l.key === line);
  return known ? { text: known.label, phrase: true } : { text: line, phrase: false };
}

export interface CashFlowLine {
  line: string;
  section: string;
  amount: number;
  cameIn: number;
  wentOut: number;
  journals: number;
  accounts: { code: string; name: string; amount: number }[];
}

/** Where the cash came from and went in the dates (report_cash_flow). */
export interface CashFlow {
  from: string;
  to: string;
  cash: { code: string; name: string; opening: number; closing: number }[];
  opening: number;
  closing: number;
  lines: CashFlowLine[];
  operating: number;
  investing: number;
  financing: number;
  exchange: number;
  net: number;
  difference: number;
}

export function cashFlowFrom(v: unknown): CashFlow {
  const o = obj(v);
  return {
    from: str(o.from),
    to: str(o.to),
    cash: list(o.cash).map((c) => ({
      code: str(c.code),
      name: str(c.name),
      opening: num(c.opening),
      closing: num(c.closing),
    })),
    opening: num(o.opening),
    closing: num(o.closing),
    lines: list(o.lines).map((l) => ({
      line: str(l.line),
      section: str(l.section),
      amount: num(l.amount),
      cameIn: num(l.in),
      wentOut: num(l.out),
      journals: num(l.journals),
      accounts: list(l.accounts).map((a) => ({
        code: str(a.code),
        name: str(a.name),
        amount: num(a.amount),
      })),
    })),
    operating: num(o.operating),
    investing: num(o.investing),
    financing: num(o.financing),
    exchange: num(o.exchange),
    net: num(o.net),
    difference: num(o.difference),
  };
}

/** A section's total as the statement gives it. */
export function sectionTotal(f: CashFlow, section: CashFlowSection): number {
  return f[section];
}

/** Every word this file gives a screen: each is a phrase in the books. */
export const STATEMENT_PHRASES: readonly string[] = [
  ...CASH_FLOW_SECTIONS.map((s) => s.label),
  ...CASH_FLOW_LINES.map((l) => l.label),
];

const num = (v: unknown): number => {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const str = (v: unknown): string => (v === null || v === undefined ? "" : String(v));
const list = (v: unknown): Record<string, unknown>[] =>
  Array.isArray(v) ? (v as Record<string, unknown>[]) : [];
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
