/**
 * The drawer in sessions (0036, release K), as the screens handle it: the
 * notes counted, and what stays in the drawer. Pure: the till, the Sales
 * screen and the tests read through here. What the drawer should hold is never
 * worked out here: the count is blind, and the database shows it only once the
 * count is in, or to those who may see it.
 */
import Decimal from "decimal.js";
import { normaliseNumber } from "@/lib/validation";

/** The dinar notes in use, largest first. */
export const IQD_NOTES = [50000, 25000, 10000, 5000, 1000, 500, 250] as const;

/** How many of each note were counted: the note's value → how many. */
export type NoteCount = Record<string, number>;

/** Whole notes only; an empty or unreadable box counts as none. */
export function noteQty(v: string): number | null {
  const s = normaliseNumber(v);
  if (s === "") return 0;
  if (!/^\d+$/.test(s)) return null;
  return Number(s);
}

/** What the notes come to, or null when a box is not a whole number. */
export function notesTotal(typed: Record<string, string>): number | null {
  let sum = new Decimal(0);
  for (const [note, qty] of Object.entries(typed)) {
    const n = noteQty(qty);
    if (n === null) return null;
    sum = sum.plus(new Decimal(note).times(n));
  }
  return sum.toNumber();
}

/** The notes as the database keeps them: only those counted. */
export function notesCounted(typed: Record<string, string>): NoteCount | null {
  const out: NoteCount = {};
  for (const [note, qty] of Object.entries(typed)) {
    const n = noteQty(qty);
    if (n === null) return null;
    if (n > 0) out[note] = n;
  }
  return Object.keys(out).length > 0 ? out : null;
}

const amount = (v: string): Decimal | null => {
  const s = normaliseNumber(v);
  if (s === "" || !/^\d+(\.\d+)?$/.test(s)) return null;
  return new Decimal(s);
};

/** A close as the form previews it: what was counted, what stays, what is taken. */
export interface CloseSplit {
  counted: number | null;
  left: number | null;
  taken: number | null;
  /** A phrase of the sales book: the form shows it in the reader's language (msg()). */
  error: string | null;
}

export function closeSplit(counted: string, left: string): CloseSplit {
  const c = amount(counted);
  if (c === null) return { counted: null, left: null, taken: null, error: null };
  const l = left.trim() === "" ? c : amount(left);
  if (l === null || l.gt(c)) {
    return {
      counted: c.toNumber(),
      left: null,
      taken: null,
      error: "What stays in the drawer must be between 0 and the cash counted.",
    };
  }
  return { counted: c.toNumber(), left: l.toNumber(), taken: c.minus(l).toNumber(), error: null };
}

/** A session's cash and card, as the database adds them up (session_figures). */
export interface SessionFigures {
  moved: number;
  cashSales: number;
  refunds: number;
  voids: number;
  paidOut: number;
  cashIn: number;
  cashOut: number;
  card: number;
  orders: number;
}

/** The drawer as the till is told about it (cash_session_status). */
export interface DrawerState {
  location: string;
  drawer: string;
  open: boolean;
  session: {
    id: string;
    no: number;
    cashierId: string;
    cashier: string;
    openedAt: string;
    openedBy: string;
    /** The signed-in person's own session. */
    mine: boolean;
  } | null;
  mayOpen: boolean;
  mayClose: boolean;
  /** A manager: closes another's session, or one left open. */
  mayForce: boolean;
  /** A manager: puts a float in from the safe as the drawer opens. */
  mayAddFloat: boolean;
  /** Only the owner, general managers, accountants and auditors (cash.view_expected). */
  seesExpected: boolean;
  expected: number | null;
  figures: SessionFigures | null;
  openBills: number;
  /** Who may take the drawer over. */
  takers: { id: string; name: string }[];
  /**
   * The till's dollars (0043): whether it holds any, to count them at the
   * close; how many and their value only for those who may see it.
   */
  dollars: { inTill: boolean; usd: number | null; value: number | null };
}

/** The answer to a count, shown once it is in. */
export interface CountResult {
  sessionNo: number;
  expected: number | null;
  counted: number | null;
  variance: number | null;
  left: number | null;
  taken: number;
  takenTo: string | null;
  journalNo: number | null;
  figures: SessionFigures | null;
  /** An opening that took over from the drawer counts before sessions. */
  tookOver: boolean;
  floatFromSafe: number;
  /** A handover: the session that opened next, and whose it is. */
  nextSessionNo: number | null;
  nextCashier: string | null;
  /**
   * The till's dollars at a close (0043): what it should have held, counted,
   * the difference and its value, all taken to the safe. Null when none were
   * counted; `usdCarried` when they were left in the till uncounted.
   */
  usd: {
    expected: number;
    counted: number;
    variance: number;
    varianceValue: number;
    taken: number;
    takenValue: number;
    journalNo: number | null;
  } | null;
  usdCarried: number | null;
}

const num = (v: unknown): number => Number(v ?? 0);
const numOrNull = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

export function figuresFrom(f: Record<string, unknown> | null | undefined): SessionFigures | null {
  if (!f) return null;
  return {
    moved: num(f.moved),
    cashSales: num(f.cash_sales),
    refunds: num(f.refunds),
    voids: num(f.voids),
    paidOut: num(f.paid_out),
    cashIn: num(f.cash_in),
    cashOut: num(f.cash_out),
    card: num(f.card),
    orders: num(f.orders),
  };
}

/** The database's answer to an opening, a close or a handover. */
export function countResult(r: Record<string, unknown>): CountResult {
  const hasFigures = r.cash_sales !== undefined;
  return {
    sessionNo: num(r.session_no),
    expected: numOrNull(r.expected),
    counted: numOrNull(r.counted),
    variance: numOrNull(r.variance),
    left: numOrNull(r.left),
    taken: num(r.taken),
    takenTo: r.taken_to == null ? null : String(r.taken_to),
    journalNo: r.journal_no == null ? null : Number(r.journal_no),
    figures: hasFigures ? figuresFrom(r) : null,
    tookOver: r.took_over === true,
    floatFromSafe: num(r.float_from_safe),
    nextSessionNo: r.next_session_no == null ? null : Number(r.next_session_no),
    nextCashier: r.next_cashier == null ? null : String(r.next_cashier),
    usd:
      r.usd_counted == null
        ? null
        : {
            expected: num(r.usd_expected),
            counted: num(r.usd_counted),
            variance: num(r.usd_variance),
            varianceValue: num(r.usd_variance_value),
            taken: num(r.usd_taken),
            takenValue: num(r.usd_taken_value),
            journalNo: r.usd_journal_no == null ? null : Number(r.usd_journal_no),
          },
    usdCarried: r.usd_carried == null ? null : Number(r.usd_carried),
  };
}

export function drawerStateFrom(t: Record<string, unknown> | null): DrawerState {
  const s = (t?.session ?? null) as Record<string, unknown> | null;
  return {
    location: String(t?.location ?? ""),
    drawer: String(t?.drawer ?? ""),
    open: t?.open === true,
    session: s
      ? {
          id: String(s.id),
          no: num(s.no),
          cashierId: String(s.cashier_id),
          cashier: String(s.cashier ?? ""),
          openedAt: String(s.opened_at),
          openedBy: String(s.opened_by ?? ""),
          mine: s.mine === true,
        }
      : null,
    mayOpen: t?.may_open === true,
    mayClose: t?.may_close === true,
    mayForce: t?.may_force === true,
    mayAddFloat: t?.may_add_float === true,
    seesExpected: t?.sees_expected === true,
    expected: numOrNull(t?.expected),
    figures: figuresFrom(t?.figures as Record<string, unknown> | null),
    openBills: num(t?.open_bills),
    takers: Array.isArray(t?.takers)
      ? (t.takers as Record<string, unknown>[]).map((p) => ({
          id: String(p.id),
          name: String(p.name),
        }))
      : [],
    dollars: {
      inTill: (t?.dollars as Record<string, unknown> | undefined)?.in_till === true,
      usd: numOrNull((t?.dollars as Record<string, unknown> | undefined)?.usd),
      value: numOrNull((t?.dollars as Record<string, unknown> | undefined)?.value),
    },
  };
}

/**
 * What the safe and a till's drawer hold, for a form that pays money out of
 * them (AK), as the database gives them (drawer_status). The database refuses
 * a payment out of either that is more than it holds. The form says so before
 * the payment is sent.
 */
export interface CashOnHand {
  /** The safe's balance in the books (1005). */
  safe: number;
  /**
   * What the drawer should hold: null to a reader who may not see it (the
   * count is blind), or before its start is known.
   */
  till: number | null;
  /** Whether the drawer is open: nothing is paid out of a closed one. */
  tillOpen: boolean;
}

/** What a form says under "Paid from": a phrase, the amount it names, and whether it warns. */
export interface CashNote {
  text: string;
  amount: number | null;
  warn: boolean;
}

/**
 * The note for money paid from `from` ("safe", or the drawer as "till" or
 * "cash"). Null when there is nothing to say: another source, or a drawer
 * whose figure the reader may not see.
 */
export function cashNote(on: CashOnHand | null, from: string, amount: number): CashNote | null {
  if (!on) return null;
  if (from === "safe") {
    const short = amount > on.safe;
    return {
      text: short
        ? "The safe holds {amount} in the books: not enough to pay this. Put the takings in the safe first (Move cash, on Sales), or pay it from elsewhere."
        : "The safe holds {amount} in the books.",
      amount: on.safe,
      warn: short,
    };
  }
  if (from !== "till" && from !== "cash") return null;
  if (!on.tillOpen)
    return {
      text: "The drawer is not open: open it on the till first, or pay it from elsewhere.",
      amount: null,
      warn: true,
    };
  if (on.till === null) return null;
  const short = amount > on.till;
  return {
    text: short
      ? "The drawer should hold {amount}: not enough to pay this. Move cash into the till first, or pay it from elsewhere."
      : "The drawer should hold {amount}.",
    amount: on.till,
    warn: short,
  };
}
