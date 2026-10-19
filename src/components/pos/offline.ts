/**
 * Selling without internet (round fifteen, 0073): the quick sales a till takes
 * while the café's connection is down, kept on the till in the order they
 * were made, and sent once it is back, each with the key the till made for
 * it, so a sale sent twice is recorded once.
 *
 * What the till takes offline: a quick sale, in dinars, by cash, card or one
 * of the café's ways to pay, or a delivery platform's order. Not a bill on a
 * table (another till may have it), a discount (a manager may need to approve
 * it), a customer, or dollars: each of those needs the database to answer.
 */
import type { SalesChannel } from "@domain/sales/recipe.js";
import type { Payment } from "@/lib/payments";
import type { AddonChoice, Order } from "./model";
import type { PrintJob } from "./PrintSlip";

export interface OfflineSale {
  /** The sale's key, minted when it was paid: sent with every try. */
  key: string;
  /** When the money was taken, and who was signed in on the till then. */
  soldAt: string;
  soldBy: string | null;
  soldByName: string;
  /** The till's branch when it was sold: sent from that branch alone. */
  place: string | null;
  /** The till's own number for it, on its receipt: "Offline 3". */
  no: number;
  channel: SalesChannel;
  payments: Payment[];
  lines: { variantId: string; qty: number; addons: AddonChoice[] }[];
  /** The total the customer was shown and paid. */
  expectedNet: string;
  platformOrderNo: string | null;
  title: string;
  /** Its receipt, as printed. */
  job: PrintJob | null;
  /** Waiting to be sent, or refused and waiting for a manager. */
  state: "waiting" | "attention";
  /** Why it was refused, in the database's words. */
  error: string | null;
}

export const OFFLINE_KEY = "sixties.pos.offline.v1";
const COUNTER_KEY = "sixties.pos.offline.no";

/** What this till holds, oldest first; nothing when storage is out of reach. */
export function loadOffline(): OfflineSale[] {
  try {
    const raw = localStorage.getItem(OFFLINE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as unknown;
    return Array.isArray(list) ? list.filter(isOfflineSale) : [];
  } catch {
    return [];
  }
}

export function saveOffline(list: OfflineSale[]): boolean {
  try {
    if (list.length === 0) localStorage.removeItem(OFFLINE_KEY);
    else localStorage.setItem(OFFLINE_KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

/** The next of the till's own numbers for a sale made offline: 1, 2, 3… */
export function nextOfflineNo(list: OfflineSale[]): number {
  let last = 0;
  try {
    last = Number(localStorage.getItem(COUNTER_KEY) ?? 0) || 0;
  } catch {
    /* no storage: from what is kept */
  }
  const no = Math.max(last, ...list.map((s) => s.no), 0) + 1;
  try {
    localStorage.setItem(COUNTER_KEY, String(no));
  } catch {
    /* kept in the list itself */
  }
  return no;
}

function isOfflineSale(x: unknown): x is OfflineSale {
  if (!x || typeof x !== "object") return false;
  const s = x as Partial<OfflineSale>;
  return (
    typeof s.key === "string" &&
    typeof s.soldAt === "string" &&
    typeof s.channel === "string" &&
    Array.isArray(s.lines) &&
    s.lines.length > 0 &&
    Array.isArray(s.payments) &&
    typeof s.expectedNet === "string" &&
    (s.state === "waiting" || s.state === "attention")
  );
}

/**
 * Why this order cannot be taken offline, in words for the cashier (English;
 * the screen translates); null when it can. Dollars are not offered offline.
 */
export function offlineBlock(
  o: Pick<Order, "kind" | "channel" | "discount" | "customer">,
): string | null {
  if (o.kind === "bill") return "A bill on a table needs the internet: sell it as a quick sale";
  if (o.channel === "direct_delivery") return "The café's own delivery needs the internet";
  if (o.discount) return "A discount needs the internet: take it off to sell offline";
  if (o.customer) return "A customer needs the internet: take them off to sell offline";
  return null;
}

/** What the waiting sales hold, for the drawer and the screen. */
export function offlineTotals(list: OfflineSale[], place: string | null) {
  const here = list.filter((s) => place === null || s.place === null || s.place === place);
  const cash = here.reduce(
    (sum, s) =>
      sum + s.payments.filter((p) => p.type === "cash").reduce((a, p) => a + Number(p.amount), 0),
    0,
  );
  return {
    waiting: here.filter((s) => s.state === "waiting").length,
    attention: here.filter((s) => s.state === "attention").length,
    count: here.length,
    cash,
  };
}

/** The database refused it because a price changed since the till showed it. */
export function priceChanged(error: string | null): boolean {
  return error !== null && /a price has changed/i.test(error);
}
