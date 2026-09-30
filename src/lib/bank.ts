/**
 * The bank reconciled against its statement (0059). What a statement being
 * kept comes to: the last statement's balance, and the lines ticked, against
 * the balance the bank gives; and the bank's own statement, read from its
 * file or pasted, found line by line among the books' lines. Pure, so the
 * screen and the unit tests agree with the database, which checks it all
 * again when the statement is kept.
 */
import Decimal from "decimal.js";
import { statementAmount } from "@/lib/settlements";
import { columnNamed, headerName, isBlank, readTable, TOTAL_CELL, TOTAL_START } from "@/lib/sheet";
import { latinDigits, normaliseNumber } from "@/lib/validation";

/** A balance as the bank may give it: overdrawn is below zero. */
const SIGNED = /^-?\d+(\.\d+)?$/;

export interface BankMath {
  /** What the lines ticked brought in, and took out. */
  moneyIn: Decimal;
  moneyOut: Decimal;
  /** Where they take the bank: the last statement's balance, plus in, less out. */
  reached: Decimal;
  /** The balance the bank gives, as typed; null until it is a number. */
  closing: Decimal | null;
  /** The bank's balance less where the lines take it: zero when it ties. */
  difference: Decimal | null;
}

export function bankMath(
  opening: Decimal.Value,
  ticked: readonly Decimal.Value[],
  closingText: string,
): BankMath {
  let moneyIn = new Decimal(0);
  let moneyOut = new Decimal(0);
  for (const a of ticked) {
    const d = new Decimal(a);
    if (d.isNegative()) moneyOut = moneyOut.plus(d.negated());
    else moneyIn = moneyIn.plus(d);
  }
  const reached = new Decimal(opening).plus(moneyIn).minus(moneyOut);
  const typed = normaliseNumber(closingText);
  const closing = SIGNED.test(typed) ? new Decimal(typed) : null;
  return {
    moneyIn,
    moneyOut,
    reached,
    closing,
    difference: closing ? closing.minus(reached) : null,
  };
}

/** The lines a statement ending on a day may take: those on or before it. */
export function linesTo<T extends { day: string }>(lines: readonly T[], day: string): T[] {
  return day ? lines.filter((l) => l.day <= day) : [];
}

// --- The bank's statement, read from its file or pasted --------------------------

export interface BankStatementLine {
  /** The line of the statement it is on. */
  line: number;
  day: string;
  description: string;
  /** Money in, above zero; out, below: exact. */
  amount: string;
  /** The balance the statement gives after it, if it gives one. */
  balance: string | null;
}

export interface ParsedBankStatement {
  /** Its lines, the oldest first. */
  lines: BankStatementLine[];
  /** What could not be read, by the line of the statement it is on. */
  problems: string[];
  /** Rows left out: a title, the column names, a total, a balance brought forward. */
  skipped: number;
  /** The columns read, as the statement names them. */
  columns: string[] | null;
  /** The balance its last line leaves, when it gives balances. */
  closing: string | null;
}

/** The names a bank gives its columns, the ones preferred first. */
const BANK_HEADERS = {
  date: [
    "date",
    "transaction date",
    "trans date",
    "txn date",
    "posting date",
    "post date",
    "booking date",
    "entry date",
    "التاريخ",
    "تاريخ",
    "تاريخ العملية",
    "تاريخ الحركة",
    "تاريخ القيد",
    "تاريخ المعاملة",
    "بەروار",
    "ڕێکەوت",
    "value date",
    "تاريخ الاستحقاق",
    "تاريخ القيمة",
  ],
  description: [
    "description",
    "details",
    "transaction details",
    "narrative",
    "narration",
    "particulars",
    "memo",
    "remarks",
    "البيان",
    "الوصف",
    "التفاصيل",
    "تفاصيل",
    "تفاصيل العملية",
    "الشرح",
    "ملاحظات",
    "وەسف",
    "ڕوونکردنەوە",
    "وردەکاری",
    "تێبینی",
    "reference",
    "المرجع",
  ],
  in: [
    "credit",
    "credits",
    "credit amount",
    "deposit",
    "deposits",
    "money in",
    "paid in",
    "in",
    "دائن",
    "الدائن",
    "إيداع",
    "ايداع",
    "الإيداعات",
    "الايداعات",
    "إيداعات",
    "وارد",
    "المبلغ الدائن",
    "پارەی هاتوو",
  ],
  out: [
    "debit",
    "debits",
    "debit amount",
    "withdrawal",
    "withdrawals",
    "money out",
    "paid out",
    "out",
    "مدين",
    "المدين",
    "سحب",
    "السحب",
    "المسحوبات",
    "مسحوبات",
    "صادر",
    "المبلغ المدين",
    "پارەی ڕۆیشتوو",
  ],
  amount: ["amount", "transaction amount", "المبلغ", "مبلغ", "مبلغ العملية", "بڕ", "بڕی پارە"],
  balance: [
    "balance",
    "running balance",
    "available balance",
    "ledger balance",
    "book balance",
    "الرصيد",
    "رصيد",
    "الرصيد الحالي",
    "الرصيد بعد العملية",
    "باڵانس",
    "ماوە",
  ],
  /** Whether an amount is a debit or a credit, when the statement says so in a column of its own. */
  sign: [
    "dr/cr",
    "cr/dr",
    "d/c",
    "c/d",
    "debit/credit",
    "credit/debit",
    "type",
    "مدين/دائن",
    "دائن/مدين",
    "النوع",
    "نوع العملية",
    "نوع الحركة",
    "جۆر",
  ],
};

type BankAt = Record<keyof typeof BANK_HEADERS, number | null>;

function bankColumns(cells: string[]): BankAt | null {
  const names = cells.map(headerName);
  const at = Object.fromEntries(
    Object.entries(BANK_HEADERS).map(([k, wanted]) => [k, columnNamed(names, wanted)]),
  ) as BankAt;
  return at.date !== null && (at.in !== null || at.out !== null || at.amount !== null) ? at : null;
}

/** A balance brought or carried forward: not money in or out. */
const BALANCE_ROW =
  /^(opening|closing|previous)\s+balance\b|^balance\s+(b\/?f|c\/?f|brought|carried|forward)\b|^(brought|carried)\s+forward\b|^(b\/?f|c\/?f)$|^(ال)?رصيد\s*(ال)?(افتتاحي|سابق|مدور|ختامي|منقول)|^رصيد\s+(أول|اول|آخر|اخر)\s+المدة|^باڵانسی\s*(سەرەتا|پێشوو|کۆتایی)/i;

/** An empty column, as some statements print one. */
const NOTHING = /^[-–—_.]+$/;

/** An amount as a bank prints it: "1,500.00", "(900)", "-900", "900 DR", "CR 1,500". */
function bankAmount(cell: string): string | null {
  const m = /^(?:(dr|cr)\.?\s*)?(.*?)(?:\s*(dr|cr)\.?)?$/i.exec(cell.trim());
  const v = statementAmount(m?.[2] ?? cell);
  if (v === null) return null;
  const mark = (m?.[1] ?? m?.[3] ?? "").toLowerCase();
  const d = new Decimal(v);
  return (mark === "dr" ? d.abs().negated() : mark === "cr" ? d.abs() : d).toFixed();
}

/** What a DR/CR column says: money out, money in, or nothing. */
function markOf(cell: string): "in" | "out" | null {
  const s = cell.trim().toLowerCase();
  if (/^(dr|d|debit|مدين|سحب)$/.test(s)) return "out";
  if (/^(cr|c|credit|دائن|إيداع|ايداع)$/.test(s)) return "in";
  return null;
}

const MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

function ymd(y: number, m: number, d: number): string | null {
  if (!(y >= 1990 && y <= 2100 && m >= 1 && m <= 12 && d >= 1)) return null;
  if (d > new Date(Date.UTC(y, m, 0)).getUTCDate()) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

const fullYear = (y: string) => (y.length === 2 ? 2000 + Number(y) : Number(y));

const NUMERIC_DAY = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2})(?!\d)/;

export type DayOrder = "dmy" | "mdy";

/**
 * Day before month (14/09/2026), as a date is written in Iraq; month first
 * (09/14/2026) only when the statement's own dates show it, one with a day
 * past the 12th.
 */
export function dayOrder(cells: readonly string[]): DayOrder {
  for (const cell of cells) {
    const m = NUMERIC_DAY.exec(latinDigits(cell).trim());
    if (!m) continue;
    if (Number(m[1]) > 12) return "dmy";
    if (Number(m[2]) > 12) return "mdy";
  }
  return "dmy";
}

/**
 * A date as a statement prints it, as 2026-09-14: 2026-09-14, 14/09/2026,
 * 14-09-26, 14 Sep 2026, Sep 14, 2026, with a time after it or not; and a
 * spreadsheet's day number whose date format was lost (46279). Null when it
 * is not one.
 */
export function statementDay(cell: string, order: DayOrder = "dmy"): string | null {
  const s = latinDigits(cell).trim();
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?!\d)/.exec(s);
  if (m) return ymd(Number(m[1]), Number(m[2]), Number(m[3]));
  m = NUMERIC_DAY.exec(s);
  if (m) {
    const [a, b, y] = [Number(m[1]), Number(m[2]), fullYear(m[3]!)];
    return order === "mdy" ? ymd(y, a, b) : ymd(y, b, a);
  }
  m = /^(\d{1,2})[-\s/.]*([a-z]{3,9})\.?[-\s/.,]*(\d{4}|\d{2})(?!\d)/i.exec(s);
  if (m) {
    const month = MONTHS[m[2]!.slice(0, 3).toLowerCase()];
    return month ? ymd(fullYear(m[3]!), month, Number(m[1])) : null;
  }
  m = /^([a-z]{3,9})\.?[-\s/.]*(\d{1,2})(?:st|nd|rd|th)?,?[-\s/.]*(\d{4})(?!\d)/i.exec(s);
  if (m) {
    const month = MONTHS[m[1]!.slice(0, 3).toLowerCase()];
    return month ? ymd(Number(m[3]), month, Number(m[2])) : null;
  }
  m = /^(\d{5})(?:\.\d+)?$/.exec(s);
  if (m && Number(m[1]) >= 32874 && Number(m[1]) <= 73050)
    return new Date((Number(m[1]) - 25569) * 86400000).toISOString().slice(0, 10);
  return null;
}

/**
 * The lines in the order they happened. A statement may give the newest
 * first: its running balance tells, each line's balance being the one before
 * it plus the line; without balances, its dates do.
 */
function oldestFirst(lines: BankStatementLine[]): BankStatementLine[] {
  let up = 0;
  let down = 0;
  for (let i = 1; i < lines.length; i++) {
    const [a, b] = [lines[i - 1]!, lines[i]!];
    if (a.balance === null || b.balance === null) continue;
    if (new Decimal(a.balance).plus(b.amount).eq(b.balance)) up++;
    if (new Decimal(b.balance).plus(a.amount).eq(a.balance)) down++;
  }
  const first = lines[0]?.day ?? "";
  const last = lines[lines.length - 1]?.day ?? "";
  const ordered = down > up || (down === up && first > last) ? [...lines].reverse() : [...lines];
  return ordered
    .map((l, i) => ({ l, i }))
    .sort((x, y) => (x.l.day < y.l.day ? -1 : x.l.day > y.l.day ? 1 : x.i - y.i))
    .map((x) => x.l);
}

const HEADER_SEARCH = 30;
const MAX_BANK_LINES = 2000;

/** A bank's statement as the reading knows it, its column names in the reader's language. */
export const BANK_EXAMPLE: Record<string, string> = {
  en: "Date\tDescription\tDebit\tCredit\tBalance\n14/09/2026\tTransfer\t500,000\t\t1,500,000",
  ar: "التاريخ\tالبيان\tمدين\tدائن\tالرصيد\n14/09/2026\tحوالة\t500,000\t\t1,500,000",
  ckb: "بەروار\tوەسف\tپارەی ڕۆیشتوو\tپارەی هاتوو\tباڵانس\n14/09/2026\tحەواڵە\t500,000\t\t1,500,000",
};

/**
 * The lines of the bank's statement, read from its file or pasted: each
 * line's date, what it is, and the money in or out, from columns named as
 * banks name them ("Date", "Description", "Debit", "Credit", "Balance", in
 * English or Arabic), found below the account's details the statement starts
 * with. One amount column is read by its sign, or by a DR/CR mark or column.
 * Totals, balances brought forward, and rows where no money moved are left
 * out.
 */
export function parseBankStatement(text: string): ParsedBankStatement {
  const rows = readTable(text).filter((r) => !isBlank(r));
  const named = rows.slice(0, HEADER_SEARCH).findIndex((r) => bankColumns(r.cells) !== null);
  if (named < 0)
    return {
      lines: [],
      problems: [
        "The columns were not recognised. Name them Date, Money in and Money out (or Amount), and Balance if the statement gives it.",
      ],
      skipped: 0,
      columns: null,
      closing: null,
    };
  const header = rows[named]!.cells;
  const at = bankColumns(header)!;
  const columns = [at.date, at.description, at.in, at.out, at.amount, at.sign, at.balance]
    .filter((i): i is number => i !== null)
    .map((i) => header[i]!);
  const problems: string[] = [];
  const lines: BankStatementLine[] = [];
  let skipped = named + 1;
  const data = rows.slice(named + 1);
  const order = dayOrder(data.map((r) => r.cells[at.date!] ?? ""));

  for (const { line, cells: c } of data) {
    const dateCell = c[at.date!] ?? "";
    const what = at.description === null ? "" : (c[at.description] ?? "");
    if (
      c.some((x) => TOTAL_CELL.test(x)) ||
      [c[0] ?? "", dateCell, what].some((x) => TOTAL_START.test(x) || BALANCE_ROW.test(x))
    ) {
      skipped++;
      continue;
    }
    let bad: string | null = null;
    const read = (i: number | null): Decimal | null => {
      if (i === null) return null;
      const cell = c[i] ?? "";
      if (cell === "" || NOTHING.test(cell)) return null;
      const v = bankAmount(cell);
      if (v === null) bad ??= cell;
      return v === null ? null : new Decimal(v);
    };
    let amount: Decimal | null = null;
    if (at.in !== null || at.out !== null) {
      const into = read(at.in);
      const out = read(at.out);
      if (into !== null || out !== null)
        amount = (into?.abs() ?? new Decimal(0)).minus(out?.abs() ?? new Decimal(0));
    } else {
      amount = read(at.amount);
      const mark = at.sign === null ? null : markOf(c[at.sign] ?? "");
      if (amount !== null && mark !== null)
        amount = mark === "out" ? amount.abs().negated() : amount.abs();
    }
    if (bad !== null) {
      problems.push(`Line ${line}: "${bad}" is not an amount.`);
      continue;
    }
    // A title, a note, or a balance with no money moved.
    if (amount === null || amount.isZero()) {
      skipped++;
      continue;
    }
    const day = statementDay(dateCell, order);
    if (day === null) {
      problems.push(
        dateCell === ""
          ? `Line ${line} has an amount but no date.`
          : `Line ${line}: "${dateCell}" is not a date.`,
      );
      continue;
    }
    const balanceCell = at.balance === null ? "" : (c[at.balance] ?? "");
    lines.push({
      line,
      day,
      description: what,
      amount: amount.toFixed(),
      balance: balanceCell === "" || NOTHING.test(balanceCell) ? null : bankAmount(balanceCell),
    });
    if (lines.length > MAX_BANK_LINES) {
      problems.push(`A statement is read ${MAX_BANK_LINES} lines at a time.`);
      return { lines: [], problems, skipped, columns, closing: null };
    }
  }
  const ordered = oldestFirst(lines);
  return {
    lines: ordered,
    problems,
    skipped,
    columns,
    closing: ordered[ordered.length - 1]?.balance ?? null,
  };
}

/** A line of the bank in the books, on no statement yet. */
export interface BankOpenLine {
  lineId: string;
  day: string;
  amount: number;
}

export interface BankStatementMatch {
  /** The statement's lines after the last statement kept, each with the books' line it is, if any. */
  lines: { line: BankStatementLine; lineId: string | null }[];
  /** The books' lines it shows: the ones to tick. */
  ticked: string[];
  /** Its lines on or before the last statement kept's day: on that one already. */
  before: number;
  /** The day of its last line: the day the statement ends. */
  lastDay: string | null;
  /** The balance before its first line, and the one its last line leaves, when it gives balances. */
  opening: string | null;
  closing: string | null;
}

/** How far the books' day may be from the bank's: a cheque cashed weeks after it was written. */
const BOOKS_BEFORE = 31;
const BOOKS_AFTER = 7;

const daysApart = (later: string, earlier: string) =>
  Math.round((Date.parse(later) - Date.parse(earlier)) / 86400000);

/**
 * The bank's statement against the books' lines on no statement yet: each of
 * its lines is the books' line of the same amount, on the same day if there
 * is one, else on the nearest day within reach (up to a month before, a week
 * after); each of the books' lines is found once. What it leaves is on the
 * statement and not in the books (a bank's charge, interest), or in the books
 * and not on the statement yet (a transfer on its way).
 */
export function matchBankStatement(
  parsed: ParsedBankStatement,
  open: readonly BankOpenLine[],
  after: string,
): BankStatementMatch {
  const lines = parsed.lines.filter((l) => after === "" || l.day > after);
  const lastDay = lines[lines.length - 1]?.day ?? null;
  const books = open
    .filter((b) => lastDay !== null && b.day <= lastDay)
    .map((b) => ({ ...b, key: new Decimal(b.amount).toFixed() }));
  const used = new Set<string>();
  const found = new Map<number, string>();
  const keys = lines.map((l) => new Decimal(l.amount).toFixed());
  lines.forEach((l, i) => {
    const b = books.find((x) => !used.has(x.lineId) && x.key === keys[i] && x.day === l.day);
    if (!b) return;
    used.add(b.lineId);
    found.set(i, b.lineId);
  });
  lines.forEach((l, i) => {
    if (found.has(i)) return;
    let best: (typeof books)[number] | null = null;
    let gapOfBest = Infinity;
    for (const b of books) {
      if (used.has(b.lineId) || b.key !== keys[i]) continue;
      const gap = daysApart(l.day, b.day);
      if (gap > BOOKS_BEFORE || gap < -BOOKS_AFTER || Math.abs(gap) >= gapOfBest) continue;
      best = b;
      gapOfBest = Math.abs(gap);
    }
    if (!best) return;
    used.add(best.lineId);
    found.set(i, best.lineId);
  });
  const first = lines[0];
  return {
    lines: lines.map((line, i) => ({ line, lineId: found.get(i) ?? null })),
    ticked: [...used],
    before: parsed.lines.length - lines.length,
    lastDay,
    opening:
      first && first.balance !== null
        ? new Decimal(first.balance).minus(first.amount).toFixed()
        : null,
    closing: lines[lines.length - 1]?.balance ?? null,
  };
}

// --- A line the bank shows and the books don't, recorded ----------------------------

/** Where an expense may be paid from, as Expenses names it. */
const PAID_FROM = ["till", "safe", "bank", "card", "owner"] as const;
export type PaidFromKey = (typeof PAID_FROM)[number];

/** What a link to Expenses fills in: each part only when it can be one. */
export interface ExpensePrefill {
  description?: string;
  amount?: string;
  date?: string;
  paidFrom?: PaidFromKey;
  /** Where the person goes back to once it is recorded. */
  back: "/accounting/bank" | null;
}

/**
 * The link that opens Expenses with a line of the bank's statement filled in:
 * the bank's words, the amount, its day, paid from the bank, and the way back
 * to the statement. The person chooses the account and posts it.
 */
export function expenseLink(line: BankStatementLine): string {
  const q = new URLSearchParams({
    what: line.description.trim().slice(0, 200),
    amount: new Decimal(line.amount).abs().toFixed(),
    on: line.day,
    from: "bank",
    back: "bank",
  });
  return `/expenses?${q.toString()}`;
}

/** What a link to Expenses asks to fill in; nothing that could not be one. */
export function expenseFromLink(
  sp: Record<string, string | string[] | undefined>,
  today: string,
): ExpensePrefill | null {
  const one = (k: string) => {
    const v = sp[k];
    return typeof v === "string" ? v : "";
  };
  const out: ExpensePrefill = { back: one("back") === "bank" ? "/accounting/bank" : null };
  const what = one("what").trim().slice(0, 200);
  if (what) out.description = what;
  const amount = normaliseNumber(one("amount"));
  if (/^\d+(\.\d+)?$/.test(amount) && Number(amount) > 0) out.amount = amount;
  const on = one("on");
  if (statementDay(on) === on && on <= today) out.date = on;
  const from = one("from");
  if ((PAID_FROM as readonly string[]).includes(from)) out.paidFrom = from as PaidFromKey;
  return out.description || out.amount || out.date || out.paidFrom || out.back ? out : null;
}

/** What a link to Journals fills in: money the bank received, its other side to choose. */
export interface JournalPrefill {
  description?: string;
  date?: string;
  amount: string;
  /** The account the money went into: the bank. */
  debit: "1020";
  back: "/accounting/bank" | null;
}

/**
 * The link that opens a journal with money the bank received filled in (a
 * bank's interest, a transfer from someone): Dr 1020 Bank, the amount, its
 * day and the bank's words, and the way back. The account it came from is
 * the person's to choose.
 */
export function journalLink(line: BankStatementLine): string {
  const q = new URLSearchParams({
    what: line.description.trim().slice(0, 200),
    amount: new Decimal(line.amount).abs().toFixed(),
    on: line.day,
    dr: "1020",
    back: "bank",
  });
  return `/journals?${q.toString()}`;
}

/** What a link to Journals asks to fill in: only money into the bank, and only what can be. */
export function journalFromLink(
  sp: Record<string, string | string[] | undefined>,
  today: string,
): JournalPrefill | null {
  const one = (k: string) => {
    const v = sp[k];
    return typeof v === "string" ? v : "";
  };
  const amount = normaliseNumber(one("amount"));
  if (one("dr") !== "1020" || !/^\d+(\.\d+)?$/.test(amount) || !(Number(amount) > 0)) return null;
  const out: JournalPrefill = {
    amount,
    debit: "1020",
    back: one("back") === "bank" ? "/accounting/bank" : null,
  };
  const what = one("what").trim().slice(0, 200);
  if (what) out.description = what;
  const on = one("on");
  if (statementDay(on) === on && on <= today) out.date = on;
  return out;
}

/** Where a line the bank shows and the books don't is recorded: out on Expenses, in by a journal. */
export const recordLink = (line: BankStatementLine) =>
  Number(line.amount) < 0 ? expenseLink(line) : journalLink(line);
