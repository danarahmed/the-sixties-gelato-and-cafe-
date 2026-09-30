/**
 * Card and platform money (0030, the audit's P1-9). The card takings waiting
 * to be settled, and what a settlement would post; a delivery platform's
 * statement read from what is pasted, and what the database's match of it
 * says. Pure, so the screens and the unit tests agree with the database,
 * which does the posting and checks it all again.
 */
import Decimal from "decimal.js";
import { cleanOrderNo, normaliseNumber, ORDER_NO } from "@/lib/validation";
import {
  columnNamed,
  headerName,
  isBlank,
  PROSE,
  readTable,
  TOTAL_CELL,
  TOTAL_START,
} from "@/lib/sheet";

const numOf = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};
const numOrNull = (v: unknown): number | null => (v === null || v === undefined ? null : numOf(v));
const strOrNull = (v: unknown): string | null =>
  v === null || v === undefined || v === "" ? null : String(v);
const list = (v: unknown): Record<string, unknown>[] =>
  Array.isArray(v) ? (v as Record<string, unknown>[]) : [];

// --- Card takings ------------------------------------------------------------

export interface CardDay {
  day: string;
  /** What the till took by card that day, less refunds and voids. */
  amount: number;
}

export interface CardSettlement {
  id: string;
  coversFrom: string;
  coversTo: string;
  tillTotal: number;
  terminalTotal: number;
  received: number;
  fee: number;
  difference: number;
  receivedOn: string;
  reference: string | null;
  note: string | null;
  journalNo: number | null;
  by: string | null;
  at: string;
  cancelledAt: string | null;
  cancelReason: string | null;
}

export interface CardTakings {
  /** The first day not yet settled; null before the first settlement. */
  from: string | null;
  /** Each day with card takings not yet settled. */
  days: CardDay[];
  /** 1010 Card clearing now. */
  balance: number;
  settlements: CardSettlement[];
}

export function parseCardTakings(raw: unknown): CardTakings {
  const o = (raw ?? {}) as Record<string, unknown>;
  return {
    from: strOrNull(o.from),
    days: list(o.days).map((d) => ({ day: String(d.day), amount: numOf(d.amount) })),
    balance: numOf(o.balance),
    settlements: list(o.settlements).map((s) => ({
      id: String(s.id),
      coversFrom: String(s.covers_from),
      coversTo: String(s.covers_to),
      tillTotal: numOf(s.till_total),
      terminalTotal: numOf(s.terminal_total),
      received: numOf(s.received),
      fee: numOf(s.fee),
      difference: numOf(s.difference),
      receivedOn: String(s.received_on),
      reference: strOrNull(s.reference),
      note: strOrNull(s.note),
      journalNo: numOrNull(s.journal_no),
      by: strOrNull(s.by),
      at: String(s.at),
      cancelledAt: strOrNull(s.cancelled_at),
      cancelReason: strOrNull(s.cancel_reason),
    })),
  };
}

/** The till's card takings of the days waiting, up to and including `through`. */
export function tillThrough(days: CardDay[], through: string): Decimal {
  return days.filter((d) => d.day <= through).reduce((s, d) => s.plus(d.amount), new Decimal(0));
}

/** The one settlement that can be cancelled: the latest in force (they go in order). */
export function cancellableCard(settlements: CardSettlement[]): string | null {
  const live = settlements.filter((s) => !s.cancelledAt);
  if (live.length === 0) return null;
  return live.reduce((a, b) => (b.coversFrom > a.coversFrom ? b : a)).id;
}

const AMOUNT = /^\d+(\.\d+)?$/;

export interface CardMath {
  terminal: Decimal | null;
  received: Decimal | null;
  /** The terminal's total less what reached the bank: the card company's fee. */
  fee: Decimal | null;
  /** The till's takings less the terminal's: a sale rung as card that was not, or the reverse. */
  difference: Decimal | null;
  problem: "terminal" | "received" | "more_than_terminal" | null;
}

/** What a settlement would post, as the database works it out (record_card_settlement). */
export function cardMath(
  till: Decimal.Value,
  terminalText: string,
  receivedText: string,
): CardMath {
  const t = normaliseNumber(terminalText);
  const r = normaliseNumber(receivedText);
  const terminal = AMOUNT.test(t) ? new Decimal(t) : null;
  const received = AMOUNT.test(r) ? new Decimal(r) : null;
  const problem =
    terminal === null
      ? "terminal"
      : received === null
        ? "received"
        : received.greaterThan(terminal)
          ? "more_than_terminal"
          : null;
  return {
    terminal,
    received,
    fee: terminal && received ? terminal.minus(received) : null,
    difference: terminal ? new Decimal(till).minus(terminal) : null,
    problem,
  };
}

// --- A platform's statement, pasted ---------------------------------------------

export interface StatementLine {
  orderNo: string;
  /** What the platform paid for the order, as an exact decimal. */
  payout: string;
  /** What it kept; null when the statement does not say. */
  commission: string | null;
  fees: string | null;
}

export interface ParsedStatement {
  lines: StatementLine[];
  /** What could not be read, by the line of the paste it is on. */
  problems: string[];
  /** Total rows left out. */
  skipped: number;
  /** Other rows left out: a title above the column names, a note. */
  other: number;
  /** The columns read, when the paste starts with their names. */
  columns: {
    orderNo: string;
    payout: string;
    commission: string | null;
    fees: string | null;
  } | null;
}

const HEADERS: Record<"orderNo" | "payout" | "commission" | "fees", string[]> = {
  orderNo: [
    "order",
    "order id",
    "order no",
    "order number",
    "order ref",
    "order reference",
    "order code",
    "رقم الطلب",
    "الطلب",
    "ژمارەی داواکاری",
  ],
  payout: [
    "payout",
    "net payout",
    "payout amount",
    "net",
    "net amount",
    "amount paid",
    "paid",
    "paid out",
    "payable",
    "net payable",
    "amount payable",
    "settlement",
    "settlement amount",
    "you receive",
    "vendor payout",
    "restaurant payout",
    "store payout",
    "صافي المبلغ",
    "المبلغ المستحق",
    "المدفوع",
  ],
  commission: ["commission", "commission amount", "platform commission", "العمولة", "عمولة"],
  fees: [
    "fee",
    "fees",
    "other fees",
    "service fee",
    "service fees",
    "delivery fee",
    "delivery fees",
    "delivery charge",
    "delivery charges",
    "payment fee",
    "payment fees",
    "transaction fee",
    "transaction fees",
    "processing fee",
    "processing fees",
    "charges",
    "other charges",
    "الرسوم",
    "رسوم",
    "رسوم التوصيل",
    "رسوم الدفع",
    "رسوم الخدمة",
  ],
};
/** What a platform took in all, commission and fees together: read as fees only when nothing else is. */
const DEDUCTIONS = ["deductions", "الخصومات", "الاستقطاعات"];
/**
 * An amount as a statement prints it: "1,500", "IQD 1500", "(900)" or "-900".
 * Null when it is not one.
 */
export function statementAmount(cell: string): string | null {
  let s = normaliseNumber(cell.replace(/IQD|د\.ع|دينار|دینار/gi, ""));
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  if (s.startsWith("-")) {
    negative = !negative;
    s = s.slice(1);
  }
  if (!AMOUNT.test(s)) return null;
  const d = new Decimal(s);
  return (negative && !d.isZero() ? d.negated() : d).toFixed();
}

const MAX_LINES = 2000;
/** How far down a report its column names may be: below its title, the period, the account. */
const HEADER_SEARCH = 30;

/** Where each column is: named, or in the order the statement's lines give them. */
type At = { orderNo: number; payout: number; commission: number | null; fees: number[] };

/** A commission or a fee named with more words: "Talabat commission", "Delivery fee". */
const COMMISSION_NAMED = /(^|\s)(commission|العمولة|عمولة)$/;
const FEE_NAMED = /(^|\s)(fees?|charges?)$|^رسوم\s/;
/** A total of what is kept: not one more fee to add. */
const TOTAL_NAMED = /^(total|sum)\b|الإجمالي|إجمالي|اجمالي|مجموع/;

function columnsNamed(cells: string[]): At | null {
  const names = cells.map(headerName);
  const orderNo = columnNamed(names, HEADERS.orderNo);
  const payout = columnNamed(names, HEADERS.payout);
  if (orderNo === null || payout === null) return null;
  const found = columnNamed(names, HEADERS.commission);
  const named = names.findIndex(
    (n, i) => i !== orderNo && i !== payout && COMMISSION_NAMED.test(n),
  );
  const commission = found ?? (named >= 0 ? named : null);
  // Every column the report splits its fees into (delivery, payment, service), added up.
  const taken = (i: number) => i === orderNo || i === payout || i === commission;
  const fees = names.flatMap((n, i) =>
    !taken(i) && !TOTAL_NAMED.test(n) && (HEADERS.fees.includes(n) || FEE_NAMED.test(n)) ? [i] : [],
  );
  const deductions = columnNamed(names, DEDUCTIONS);
  return {
    orderNo,
    payout,
    commission,
    fees: fees.length > 0 || deductions === null || taken(deductions) ? fees : [deductions],
  };
}

/**
 * The lines of a statement pasted from the platform's report, or read from its
 * file: the order number and the payout, and the commission and fees when it
 * gives them. The row that names the columns is found below any title the
 * report starts with, and they are read by those names ("Order ID",
 * "Payout", "Commission", "Fees"); without one, the columns are taken in that
 * order. Commission and fees printed as deductions (-900) are read as what
 * the platform kept (900). Total rows, and a title or a note with no amount,
 * are left out.
 */
export function parseStatement(text: string): ParsedStatement {
  const rows = readTable(text).filter((r) => !isBlank(r));
  const problems: string[] = [];
  const lines: StatementLine[] = [];
  let skipped = 0;
  let other = 0;
  let columns: ParsedStatement["columns"] = null;
  let at: At = { orderNo: 0, payout: 1, commission: 2, fees: [3] };
  let from = 0;

  const named = rows.slice(0, HEADER_SEARCH).findIndex((r) => columnsNamed(r.cells) !== null);
  if (named >= 0) {
    const c = rows[named]!.cells;
    at = columnsNamed(c)!;
    columns = {
      orderNo: c[at.orderNo]!,
      payout: c[at.payout]!,
      commission: at.commission === null ? null : c[at.commission]!,
      fees: at.fees.length === 0 ? null : at.fees.map((i) => c[i]!).join(", "),
    };
    other = named;
    from = named + 1;
  } else if (rows.length > 0) {
    const first = rows[0]!;
    if (first.cells.length > 1 && statementAmount(first.cells[1] ?? "") === null) {
      problems.push(
        `Line ${first.line}: the columns were not recognised. Name them Order, Payout, and Commission and Fees if the statement has them.`,
      );
      return { lines: [], problems, skipped, other, columns: null };
    }
  }

  for (const { line: lineNo, cells: c } of rows.slice(from)) {
    const orderCell = c[at.orderNo] ?? "";
    // "Total" may be under the order number, or under the first column.
    if (
      c.some((x) => TOTAL_CELL.test(x)) ||
      TOTAL_START.test(c[0] ?? "") ||
      TOTAL_START.test(orderCell)
    ) {
      skipped++;
      continue;
    }
    const orderNo = cleanOrderNo(orderCell);
    const payoutCell = c[at.payout] ?? "";
    if (orderNo === "") {
      if (payoutCell.trim() === "") continue;
      problems.push(`Line ${lineNo} has a payout but no order number.`);
      continue;
    }
    // A title or a note ("Generated on 30/09/2026"), with no payout: not a line.
    if (
      statementAmount(payoutCell) === null &&
      (PROSE.test(orderCell) || !ORDER_NO.test(orderNo))
    ) {
      other++;
      continue;
    }
    if (!ORDER_NO.test(orderNo)) {
      problems.push(`Line ${lineNo}: "${orderCell}" is not an order number.`);
      continue;
    }
    const payout = statementAmount(payoutCell);
    if (payout === null) {
      problems.push(
        payoutCell.trim() === ""
          ? `Line ${lineNo} (order ${orderNo}) has no payout.`
          : `Line ${lineNo} (order ${orderNo}): the payout "${payoutCell}" is not an amount.`,
      );
      continue;
    }
    /** What the platform kept, from its columns added up; undefined when one cannot be read. */
    const kept = (columns: number[], what: string): string | null | undefined => {
      let sum: Decimal | null = null;
      for (const i of columns) {
        const cell = c[i] ?? "";
        if (cell.trim() === "") continue;
        const v = statementAmount(cell);
        if (v === null) {
          problems.push(
            `Line ${lineNo} (order ${orderNo}): the ${what} "${cell}" is not an amount.`,
          );
          return undefined;
        }
        sum = (sum ?? new Decimal(0)).plus(new Decimal(v).abs());
      }
      return sum === null ? null : sum.toFixed();
    };
    const commission = kept(at.commission === null ? [] : [at.commission], "commission");
    const fees = kept(at.fees, "fees");
    if (commission === undefined || fees === undefined) continue;
    lines.push({ orderNo, payout, commission, fees });
    if (lines.length > MAX_LINES) {
      problems.push(`A statement is matched ${MAX_LINES} lines at a time.`);
      return { lines: [], problems, skipped, other, columns };
    }
  }
  return { lines, problems, skipped, other, columns };
}

// --- What the database's match says ---------------------------------------------

export type LineStatus = "matched" | "not_found" | "already_paid" | "voided" | "duplicate";

export interface MatchLine {
  line: number;
  orderNo: string;
  status: LineStatus;
  payout: number;
  commission: number | null;
  fees: number | null;
  /** The sale's value, for a matched line. */
  expected: number | null;
  /** The sale's value less the payout, commission and fees. */
  difference: number | null;
  saleId: string | null;
  placedAt: string | null;
  /** The statement that already paid the order. */
  paidBy: string | null;
}

export interface JournalLine {
  code: string;
  debit: number;
  credit: number;
}

export interface StatementMatch {
  platform: string;
  lines: MatchLine[];
  /** Orders waiting, from before the latest one on the statement, that it leaves out. */
  missing: { orderNo: string; saleId: string; placedAt: string; amount: number }[];
  matched: number;
  totals: {
    orders: number;
    payout: number;
    commission: number;
    fees: number;
    difference: number;
    notPosted: number;
  };
  journal: JournalLine[];
}

const STATUSES: LineStatus[] = ["matched", "not_found", "already_paid", "voided", "duplicate"];

export function parseMatch(raw: unknown): StatementMatch {
  const o = (raw ?? {}) as Record<string, unknown>;
  const t = (o.totals ?? {}) as Record<string, unknown>;
  return {
    platform: String(o.platform ?? ""),
    lines: list(o.lines).map((l) => ({
      line: numOf(l.line),
      orderNo: String(l.order_no ?? ""),
      status: (STATUSES.includes(l.status as LineStatus) ? l.status : "not_found") as LineStatus,
      payout: numOf(l.payout),
      commission: numOrNull(l.commission),
      fees: numOrNull(l.fees),
      expected: numOrNull(l.expected),
      difference: numOrNull(l.difference),
      saleId: strOrNull(l.sale_id),
      placedAt: strOrNull(l.placed_at),
      paidBy: strOrNull(l.paid_by),
    })),
    missing: list(o.missing).map((m) => ({
      orderNo: String(m.order_no ?? ""),
      saleId: String(m.sale_id ?? ""),
      placedAt: String(m.placed_at ?? ""),
      amount: numOf(m.amount),
    })),
    matched: numOf(o.matched),
    totals: {
      orders: numOf(t.orders),
      payout: numOf(t.payout),
      commission: numOf(t.commission),
      fees: numOf(t.fees),
      difference: numOf(t.difference),
      notPosted: numOf(t.not_posted),
    },
    journal: list(o.journal).map((j) => ({
      code: String(j.code),
      debit: numOf(j.debit),
      credit: numOf(j.credit),
    })),
  };
}

/** Lines that are not a clean match: the database asks for a note when there are any. */
export function matchIssues(m: StatementMatch): number {
  return m.lines.filter((l) => l.status !== "matched" || (l.difference ?? 0) !== 0).length;
}

// --- What the platforms owe ------------------------------------------------------

export interface OrderOwed {
  platform: string;
  orderNo: string;
  saleId: string;
  placedAt: string;
  amount: number;
  /** Days since it was sold. */
  days: number;
}

export interface PlatformSettlement {
  id: string;
  platform: string;
  reference: string;
  receivedOn: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  /** Orders paid out by it. */
  orders: number;
  /** Lines on the statement. */
  lines: number;
  payout: number;
  statementTotal: number;
  note: string | null;
  journalNo: number | null;
  by: string | null;
  at: string;
  cancelledAt: string | null;
  cancelReason: string | null;
}

/** A delivery platform of the café's (0031), in use or not. */
export interface PlatformInfo {
  code: string;
  name: string;
  /** Its name in other languages, by language code. */
  names: Record<string, string>;
  active: boolean;
  /** Orders waiting to be paid out. */
  waiting: number;
  /** Products on the menu with a price on it today. */
  priced: number;
}

export interface PlatformMoney {
  platforms: PlatformInfo[];
  orders: OrderOwed[];
  /** The orders' value, waiting to be paid out. */
  waiting: number;
  /** 1100 Platform receivable now. */
  receivable: number;
  /** What 1100 holds that no order waiting explains. */
  unmatched: number;
  settlements: PlatformSettlement[];
}

export function parsePlatformMoney(raw: unknown): PlatformMoney {
  const o = (raw ?? {}) as Record<string, unknown>;
  return {
    platforms: list(o.platforms).map((p) => ({
      code: String(p.code),
      name: String(p.name),
      names:
        p.names && typeof p.names === "object" && !Array.isArray(p.names)
          ? Object.fromEntries(
              Object.entries(p.names as Record<string, unknown>).filter(
                (e): e is [string, string] => typeof e[1] === "string" && e[1].trim() !== "",
              ),
            )
          : {},
      active: p.active !== false,
      waiting: numOf(p.waiting),
      priced: numOf(p.priced),
    })),
    orders: list(o.orders).map((x) => ({
      platform: String(x.platform),
      orderNo: String(x.order_no ?? ""),
      saleId: String(x.sale_id ?? ""),
      placedAt: String(x.placed_at ?? ""),
      amount: numOf(x.amount),
      days: numOf(x.days),
    })),
    waiting: numOf(o.waiting),
    receivable: numOf(o.receivable),
    unmatched: numOf(o.unmatched),
    settlements: list(o.settlements).map((s) => ({
      id: String(s.id),
      platform: String(s.platform),
      reference: String(s.reference ?? ""),
      receivedOn: strOrNull(s.received_on),
      periodStart: strOrNull(s.period_start),
      periodEnd: strOrNull(s.period_end),
      orders: numOf(s.orders),
      lines: numOf(s.lines),
      payout: numOf(s.payout),
      statementTotal: numOf(s.statement_total),
      note: strOrNull(s.note),
      journalNo: numOrNull(s.journal_no),
      by: strOrNull(s.by),
      at: String(s.at ?? ""),
      cancelledAt: strOrNull(s.cancelled_at),
      cancelReason: strOrNull(s.cancel_reason),
    })),
  };
}

/** Each platform's orders waiting: how many, their value, and the oldest. */
export function owedByPlatform(
  orders: OrderOwed[],
): { platform: string; count: number; amount: number; oldest: string | null; overDays: number }[] {
  const by = new Map<
    string,
    { count: number; amount: Decimal; oldest: string | null; overDays: number }
  >();
  for (const o of orders) {
    const b = by.get(o.platform) ?? { count: 0, amount: new Decimal(0), oldest: null, overDays: 0 };
    b.count++;
    b.amount = b.amount.plus(o.amount);
    if (b.oldest === null || o.placedAt < b.oldest) b.oldest = o.placedAt;
    b.overDays = Math.max(b.overDays, o.days);
    by.set(o.platform, b);
  }
  return [...by.entries()]
    .map(([platform, b]) => ({
      platform,
      count: b.count,
      amount: b.amount.toNumber(),
      oldest: b.oldest,
      overDays: b.overDays,
    }))
    .sort((a, b) => a.platform.localeCompare(b.platform));
}
