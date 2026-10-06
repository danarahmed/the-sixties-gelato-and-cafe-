/**
 * The café's own ways to pay besides cash and the card machine (0069): FIB,
 * FastPay, ZainCash, Qi Card… each with an account of its own among the cash
 * (1030 onwards), where what it takes stays until it is moved: to the bank,
 * the safe or another way to pay, less what the bank or the app keeps.
 *
 * Read as the database answers. Before 0069 is applied the café has none, and
 * the till offers cash and the card, as it did.
 */

export interface PayMethod {
  id: string;
  name: string;
  /** Its account: 1030 onwards. */
  account: string;
  position: number;
  /** Out of use: no longer offered at the till; its account keeps what it holds. */
  active: boolean;
}

/** The ways to pay most cafés here take, offered to add with one press. */
export const COMMON_METHODS = ["FIB", "FastPay", "ZainCash", "Qi Card"] as const;

/** The bank's account and the safe's, the other places money is moved to or from. */
export const BANK = "1020";
export const SAFE = "1005";

const num = (v: unknown) => (v === null || v === undefined || v === "" ? 0 : Number(v));
const strOrNull = (v: unknown) => (v === null || v === undefined || v === "" ? null : String(v));

/** The ways to pay as payment_methods() lists them. */
export function payMethodsFrom(data: unknown): PayMethod[] {
  if (!Array.isArray(data)) return [];
  return data.map((x) => {
    const r = x as Record<string, unknown>;
    return {
      id: String(r.id),
      name: String(r.name ?? ""),
      account: String(r.account ?? ""),
      position: num(r.position),
      active: r.active !== false,
    };
  });
}

/** A name as the database compares it: its letters, whatever their case or spaces. */
export function sameName(a: string, b: string): boolean {
  const n = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();
  return n(a) === n(b);
}

/** The common ways to pay the café has not added yet. */
export function methodsToOffer(have: readonly { name: string }[]): string[] {
  return COMMON_METHODS.filter((c) => !have.some((m) => sameName(m.name, c)));
}

/** A move of money, as money_accounts() lists it. */
export interface MoneyMove {
  id: string;
  from: string;
  /** None: a charge alone. */
  to: string | null;
  /** What arrived where it went. */
  amount: number;
  /** What the bank or the app kept. */
  fee: number;
  on: string;
  reference: string | null;
  note: string | null;
  journalNo: number | null;
  by: string | null;
  at: string;
  cancelledAt: string | null;
  cancelReason: string | null;
}

/** What each way to pay's account holds, the bank and the safe, and the moves of money. */
export interface MoneyAccounts {
  methods: (Pick<PayMethod, "id" | "name" | "account" | "active"> & { balance: number })[];
  bank: number;
  safe: number;
  moves: MoneyMove[];
}

export function moneyAccountsFrom(data: unknown): MoneyAccounts | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  const list = (v: unknown) => (Array.isArray(v) ? (v as Record<string, unknown>[]) : []);
  return {
    methods: list(d.methods).map((m) => ({
      id: String(m.id),
      name: String(m.name ?? ""),
      account: String(m.account ?? ""),
      active: m.active !== false,
      balance: num(m.balance),
    })),
    bank: num(d.bank),
    safe: num(d.safe),
    moves: list(d.moves).map((m) => ({
      id: String(m.id),
      from: String(m.from ?? ""),
      to: strOrNull(m.to),
      amount: num(m.amount),
      fee: num(m.fee),
      on: String(m.on ?? ""),
      reference: strOrNull(m.reference),
      note: strOrNull(m.note),
      journalNo: m.journal_no == null ? null : Number(m.journal_no),
      by: strOrNull(m.by),
      at: String(m.at ?? ""),
      cancelledAt: strOrNull(m.cancelled_at),
      cancelReason: strOrNull(m.cancel_reason),
    })),
  };
}

/** What a way to pay took since the drawer was counted (drawer_methods). */
export interface MethodTakings {
  method: string;
  name: string;
  amount: number;
  payments: number;
}

export function methodTakingsFrom(data: unknown): MethodTakings[] {
  if (!Array.isArray(data)) return [];
  return (data as Record<string, unknown>[]).map((x) => ({
    method: String(x.method),
    name: String(x.name ?? ""),
    amount: num(x.amount),
    payments: num(x.payments),
  }));
}

/** A way to pay in the dates (report_payment_methods): the café's own figures only for the whole café. */
export interface MethodReportRow {
  method: string;
  name: string;
  account: string;
  active: boolean;
  sales: number;
  taken: number;
  refunded: number;
  net: number;
  movedOut: number | null;
  fees: number | null;
  balance: number | null;
}

export function methodReportFrom(data: unknown): MethodReportRow[] {
  if (!Array.isArray(data)) return [];
  return (data as Record<string, unknown>[]).map((x) => ({
    method: String(x.method),
    name: String(x.name ?? ""),
    account: String(x.account ?? ""),
    active: x.active !== false,
    sales: num(x.sales),
    taken: num(x.taken),
    refunded: num(x.refunded),
    net: num(x.net),
    movedOut: x.moved_out === undefined ? null : num(x.moved_out),
    fees: x.fees === undefined ? null : num(x.fees),
    balance: x.balance === undefined ? null : num(x.balance),
  }));
}

/**
 * Where money can be moved from, and to: a way to pay's account, the bank or
 * the safe. A move touches a way to pay's account on one side at least; the
 * bank and the safe move cash between themselves on Move cash.
 */
export function moveIsAllowed(
  from: string,
  to: string | null,
  methods: readonly { account: string }[],
): boolean {
  const isMethod = (c: string | null) => c !== null && methods.some((m) => m.account === c);
  const place = (c: string | null) => c === BANK || c === SAFE || isMethod(c);
  if (!place(from) || from === to) return false;
  if (to === null) return isMethod(from);
  return place(to) && (isMethod(from) || isMethod(to));
}
