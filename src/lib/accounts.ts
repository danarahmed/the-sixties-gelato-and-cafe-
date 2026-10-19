/**
 * Wholesale customers on account (round nineteen, 0077): a shop or a hotel
 * buys at a standing price, within a credit limit, and pays its invoices
 * later; their payments pay the oldest first.
 */

export interface AccountInvoice {
  id: string;
  no: number;
  issuedOn: string;
  dueOn: string;
  amount: number;
  status: "open" | "void";
  note: string | null;
  sale: string;
  paid: number;
  left: number;
  daysLate: number;
}

export interface AccountPayment {
  id: string;
  amount: number;
  at: string;
  account: string;
  method: string | null;
  reference: string | null;
}

export interface CustomerAccount {
  customer: string;
  name: string;
  onAccount: boolean;
  creditLimit: number;
  termsDays: number;
  wholesalePercent: number;
  balance: number;
  today: string;
  invoices: AccountInvoice[];
  payments: AccountPayment[];
}

export interface AccountRow {
  id: string;
  name: string;
  phone: string;
  onAccount: boolean;
  creditLimit: number;
  termsDays: number;
  wholesalePercent: number;
  balance: number;
  overdue: number;
  late30: number;
  late60: number;
  lateMore: number;
}

const n = (v: unknown) => (v == null ? 0 : Number(v));
const s = (v: unknown) => (v == null ? null : String(v));

export function customerAccount(d: unknown): CustomerAccount {
  const r = (d ?? {}) as Record<string, unknown>;
  const list = (v: unknown) => (Array.isArray(v) ? (v as Record<string, unknown>[]) : []);
  return {
    customer: String(r.customer),
    name: String(r.name ?? ""),
    onAccount: Boolean(r.on_account),
    creditLimit: n(r.credit_limit),
    termsDays: n(r.terms_days),
    wholesalePercent: n(r.wholesale_percent),
    balance: n(r.balance),
    today: String(r.today ?? ""),
    invoices: list(r.invoices).map((i) => ({
      id: String(i.id),
      no: n(i.no),
      issuedOn: String(i.issued_on),
      dueOn: String(i.due_on),
      amount: n(i.amount),
      status: i.status === "void" ? "void" : "open",
      note: s(i.note),
      sale: String(i.sale),
      paid: n(i.paid),
      left: n(i.left),
      daysLate: n(i.days_late),
    })),
    payments: list(r.payments).map((p) => ({
      id: String(p.id),
      amount: n(p.amount),
      at: String(p.at),
      account: String(p.account),
      method: s(p.method),
      reference: s(p.reference),
    })),
  };
}

export function accountRows(d: unknown): { rows: AccountRow[]; books: number | null } {
  const r = (d ?? {}) as Record<string, unknown>;
  const list = Array.isArray(r.customers) ? (r.customers as Record<string, unknown>[]) : [];
  return {
    books: r.books == null ? null : Number(r.books),
    rows: list.map((c) => ({
      id: String(c.id),
      name: String(c.name ?? ""),
      phone: String(c.phone ?? ""),
      onAccount: Boolean(c.on_account),
      creditLimit: n(c.credit_limit),
      termsDays: n(c.terms_days),
      wholesalePercent: n(c.wholesale_percent),
      balance: n(c.balance),
      overdue: n(c.overdue),
      late30: n(c.late_30),
      late60: n(c.late_60),
      lateMore: n(c.late_more),
    })),
  };
}

/** What they may still buy on account before reaching their limit. */
export function creditLeft(a: Pick<CustomerAccount, "creditLimit" | "balance">): number {
  return Math.max(0, a.creditLimit - a.balance);
}

/** The menu price less the customer's wholesale percentage, rounded as the café rounds money. */
export function wholesalePrice(price: number, percent: number, decimals = 0): number {
  const f = 10 ** decimals;
  const v = (price * (100 - percent)) / 100;
  // Half to even, as the database rounds (money_round).
  const x = v * f;
  const r = Math.round(x);
  const even = Math.abs(x % 1) === 0.5 ? (r % 2 === 0 ? r : r - 1) : r;
  return even / f;
}
