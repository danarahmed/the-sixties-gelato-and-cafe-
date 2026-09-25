/**
 * Card and platform money (0030, the audit's P1-9). The card takings waiting
 * to be settled, and what a settlement would post; a delivery platform's
 * statement read from what is pasted, and what the database's match of it
 * says. Pure, so the screens and the unit tests agree with the database,
 * which does the posting and checks it all again.
 */
import Decimal from "decimal.js";
import { cleanOrderNo, normaliseNumber, ORDER_NO } from "@/lib/validation";

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
    "charges",
    "other charges",
    "deductions",
    "الرسوم",
    "رسوم",
  ],
};
const TOTAL_ROW =
  /^(total|totals|grand total|sum|subtotal|المجموع|الإجمالي|المجموع الكلي|کۆ|کۆی گشتی)$/i;
const MAX_LINES = 2000;

function headerName(cell: string): string {
  return cell
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/\b(iqd)\b/g, " ")
    .replace(/[#:*]/g, " ")
    .replace(/[\s_\-.]+/g, " ")
    .trim();
}

/** One row of a paste: tab-separated from a spreadsheet, or comma/semicolon CSV with quotes. */
function cells(row: string, sep: string): string[] {
  if (sep === "\t") return row.split("\t").map((c) => c.trim());
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < row.length; i++) {
    const ch = row[i]!;
    if (quoted) {
      if (ch === '"' && row[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"' && cur.trim() === "") {
      quoted = true;
      cur = "";
    } else if (ch === sep) {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

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

/**
 * The lines of a statement pasted from the platform's report: the order
 * number and the payout, and the commission and fees when it gives them. A
 * first row that names the columns is read by those names ("Order ID",
 * "Payout", "Commission", "Fees"); without one, the columns are taken in that
 * order. Commission and fees printed as deductions (-900) are read as what
 * the platform kept (900).
 */
export function parseStatement(text: string): ParsedStatement {
  const raw = text.split(/\r?\n/);
  const first = raw.find((r) => r.trim() !== "") ?? "";
  const sep = first.includes("\t") ? "\t" : first.includes(";") && !first.includes(",") ? ";" : ",";
  const problems: string[] = [];
  const lines: StatementLine[] = [];
  let skipped = 0;
  let columns: ParsedStatement["columns"] = null;
  let at = { orderNo: 0, payout: 1, commission: 2 as number | null, fees: 3 as number | null };
  let started = false;

  for (let n = 0; n < raw.length; n++) {
    const row = raw[n]!;
    if (row.trim() === "") continue;
    const c = cells(row, sep);
    const lineNo = n + 1;

    if (!started) {
      started = true;
      const names = c.map(headerName);
      const find = (k: keyof typeof HEADERS) => {
        const i = names.findIndex((h) => HEADERS[k].includes(h));
        return i < 0 ? null : i;
      };
      const looksLikeHeader = c.length > 1 && statementAmount(c[1] ?? "") === null;
      if (looksLikeHeader) {
        const o = find("orderNo");
        const p = find("payout");
        if (o === null || p === null) {
          problems.push(
            `Line ${lineNo}: the columns were not recognised. Name them Order, Payout, and Commission and Fees if the statement has them.`,
          );
          return { lines: [], problems, skipped, columns: null };
        }
        at = { orderNo: o, payout: p, commission: find("commission"), fees: find("fees") };
        columns = {
          orderNo: c[o]!,
          payout: c[p]!,
          commission: at.commission === null ? null : c[at.commission]!,
          fees: at.fees === null ? null : c[at.fees]!,
        };
        continue;
      }
    }

    const orderCell = c[at.orderNo] ?? "";
    // "Total" may be under the order number, or under the first column.
    if (c.some((x) => TOTAL_ROW.test(x.trim()))) {
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
    const kept = (i: number | null, what: string): string | null | undefined => {
      if (i === null) return null;
      const cell = c[i] ?? "";
      if (cell.trim() === "") return null;
      const v = statementAmount(cell);
      if (v === null) {
        problems.push(`Line ${lineNo} (order ${orderNo}): the ${what} "${cell}" is not an amount.`);
        return undefined;
      }
      return new Decimal(v).abs().toFixed();
    };
    const commission = kept(at.commission, "commission");
    const fees = kept(at.fees, "fees");
    if (commission === undefined || fees === undefined) continue;
    lines.push({ orderNo, payout, commission, fees });
    if (lines.length > MAX_LINES) {
      problems.push(`A statement is matched ${MAX_LINES} lines at a time.`);
      return { lines: [], problems, skipped, columns };
    }
  }
  return { lines, problems, skipped, columns };
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

export interface PlatformMoney {
  platforms: { code: string; name: string }[];
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
    platforms: list(o.platforms).map((p) => ({ code: String(p.code), name: String(p.name) })),
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
