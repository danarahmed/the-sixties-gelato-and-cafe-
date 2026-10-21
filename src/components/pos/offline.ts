/**
 * Selling without internet (round fifteen, 0073): the quick sales a till takes
 * while the café's connection is down, kept on the till in the order they
 * were made, and sent once it is back, each with the key the till made for
 * it, so a sale sent twice is recorded once.
 *
 * What the till takes offline: a quick sale, in dinars, by cash, card or one
 * of the café's ways to pay, or a delivery platform's order; and (0082) a
 * bill on a table, its new items kept on the till and the bill paid, sent
 * when the connection is back. Not a new discount (a manager may need to
 * approve it), a customer chosen now, or dollars: each of those needs the
 * database to answer.
 */
import type { SalesChannel } from "@domain/sales/recipe.js";
import type { Payment } from "@/lib/payments";
import type { saveBillAction } from "@/lib/actions/pos";
import { customerKey, signature, type AddonChoice, type Order } from "./model";
import type { PrintJob } from "./PrintSlip";

/** What the till sends to save a bill, as saveBillAction takes it. */
export type BillSave = Parameters<typeof saveBillAction>[0];

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
  lines: {
    variantId: string;
    qty: number;
    addons: AddonChoice[];
    /** One of a meal deal's places (0089). */
    deal?: { dealId: string; key: string };
  }[];
  /** The total the customer was shown and paid. */
  expectedNet: string;
  platformOrderNo: string | null;
  title: string;
  /** Its receipt, as printed. */
  job: PrintJob | null;
  /**
   * A bill on a table paid offline (0082): the bill, its version as the till
   * last had it, and what was added to it here, saved first (with its own
   * key) when it is sent. None for a quick sale, or a bill opened offline:
   * those are sent as a quick sale.
   */
  tab?: { id: string; version: number; save: BillSave | null; saveKey: string } | null;
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

/** The discount as the bill was last saved, in signature's form. */
function savedDiscount(o: Pick<Order, "saved">): unknown {
  if (o.saved === null) return null;
  try {
    return (JSON.parse(o.saved) as [unknown, unknown])[1] ?? null;
  } catch {
    return null;
  }
}

/**
 * Why this order cannot be taken offline, in words for the cashier (English;
 * the screen translates); null when it can. Dollars are not offered offline.
 * A bill keeps the discount and customer it was saved with (the database
 * checked them then); only a new one needs the database now.
 */
export function offlineBlock(
  o: Pick<Order, "kind" | "channel" | "discount" | "customer"> &
    Partial<Pick<Order, "saved" | "savedCustomer" | "tabId">>,
): string | null {
  if (o.channel === "direct_delivery") return "The café's own delivery needs the internet";
  if (o.kind === "bill" && o.tabId) {
    const now = (JSON.parse(signature([], o.discount)) as [unknown, unknown])[1] ?? null;
    const was = savedDiscount({ saved: o.saved ?? null });
    if (JSON.stringify(now) !== JSON.stringify(was))
      return "A discount needs the internet: take it off to sell offline";
    if (customerKey(o.customer) !== (o.savedCustomer ?? ""))
      return "A customer needs the internet: take them off to sell offline";
    return null;
  }
  if (o.discount) return "A discount needs the internet: take it off to sell offline";
  if (o.customer) return "A customer needs the internet: take them off to sell offline";
  return null;
}

// ------------------------------------------------------------ bills kept on the till (0082)

/**
 * A bill changed on this till while the connection was down: kept here, with
 * the key its save is sent with, and saved when the connection is back. The
 * bill on screen is the till's own from then until it is saved.
 */
export interface KeptBill {
  /** The bill's id, or this till's own for a bill opened offline. */
  id: string;
  order: Order;
  saveKey: string;
  keptAt: string;
  place: string | null;
  /** Why the database refused to save it; it then waits for a manager. */
  error: string | null;
}

export const KEPT_BILLS_KEY = "sixties.pos.keptBills.v1";

export function loadKeptBills(): KeptBill[] {
  try {
    const raw = localStorage.getItem(KEPT_BILLS_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as unknown;
    return Array.isArray(list)
      ? (list as KeptBill[]).filter(
          (b) => b && typeof b.id === "string" && b.order && Array.isArray(b.order.lines),
        )
      : [];
  } catch {
    return [];
  }
}

export function saveKeptBills(list: KeptBill[]): boolean {
  try {
    if (list.length === 0) localStorage.removeItem(KEPT_BILLS_KEY);
    else localStorage.setItem(KEPT_BILLS_KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

/** The id a kept bill goes by: its own, or the one the till gave it. */
export function keptId(o: Order & { localId?: string }): string | null {
  return o.tabId ?? o.localId ?? null;
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
