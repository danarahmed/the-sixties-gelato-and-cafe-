/**
 * Selling without internet (round fifteen, 0073): the quick sales a till takes
 * while the café's connection is down, kept on the till in the order they
 * were made, and sent once it is back, each with the key the till made for
 * it, so a sale sent twice is recorded once.
 *
 * What the till takes offline: a quick sale, in dinars, by cash, card or one
 * of the café's ways to pay, or a delivery platform's order; (0082) a bill on
 * a table, its new items kept on the till and the bill paid, sent when the
 * connection is back; and (0101) a quick sale's discount within the cashier's
 * own cap, with its reason, and the customer chosen before the connection
 * dropped (their points earned when it is sent). Not a discount a manager
 * must approve, a reward, or dollars: each of those needs the database to
 * answer.
 */
import { practiceScoped } from "@/lib/practice";
import type { SalesChannel } from "@domain/sales/recipe.js";
import type { Payment } from "@/lib/payments";
import type { saveBillAction } from "@/lib/actions/pos";
import type Decimal from "decimal.js";
import {
  customerKey,
  discountNeeds,
  signature,
  type AddonChoice,
  type DiscountRules,
  type Order,
} from "./model";
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
  /** The total of the products the customer was shown. */
  expectedNet: string;
  /** A quick sale's discount, the cashier's own (0101): as typed, with why. */
  discount?: {
    percent: string | null;
    amount: string | null;
    reason: string | null;
    note: string | null;
  } | null;
  /** The customer chosen before the connection dropped (0101). */
  customerId?: string | null;
  /** The tip, and the service charge taken off (0090): what was paid is in the payments. */
  tip?: number;
  noService?: boolean;
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

// ------------------------------------------------------------ kept encrypted (0101)

/**
 * What the till keeps is kept encrypted on the device (plan 7, item 12), with
 * the café's key the till is handed with its page (offline_key). A device
 * nobody is signed in on shows nothing of it. Read once when the till opens
 * (openOfflineStore), then from memory; each change is written back
 * encrypted. Before 0101 (no key) it is kept as it was.
 */
const SEALED = "enc1:";
let sealKey: CryptoKey | null = null;
let opened = false;
const plain = new Map<string, string>();
/** Kept sealed with a key this till does not have: never written over. */
const unreadable = new Set<string>();

const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const unb64 = (text: string) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

async function seal(text: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const out = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, sealKey!, new TextEncoder().encode(text)),
  );
  const both = new Uint8Array(iv.length + out.length);
  both.set(iv);
  both.set(out, iv.length);
  return SEALED + b64(both);
}

async function unseal(raw: string): Promise<string | null> {
  if (!sealKey) return null;
  try {
    const both = unb64(raw.slice(SEALED.length));
    const out = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: both.slice(0, 12) },
      sealKey,
      both.slice(12),
    );
    return new TextDecoder().decode(out);
  } catch {
    return null;
  }
}

/** Open what this till keeps with the café's key (null before 0101); then read it all. */
export async function openOfflineStore(secret: string | null): Promise<void> {
  try {
    sealKey =
      secret && crypto.subtle
        ? await crypto.subtle.importKey("raw", unb64(secret), "AES-GCM", false, [
            "encrypt",
            "decrypt",
          ])
        : null;
  } catch {
    sealKey = null;
  }
  await rereadOfflineStore();
  opened = true;
}

/** Read what is kept again (another tab changed it): kept plain before, it is sealed now. */
export async function rereadOfflineStore(): Promise<void> {
  for (const name of [OFFLINE_KEY, KEPT_BILLS_KEY]) {
    const key = practiceScoped(name);
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(key);
    } catch {
      raw = null;
    }
    if (!raw) {
      plain.delete(key);
      unreadable.delete(key);
      continue;
    }
    if (raw.startsWith(SEALED)) {
      // Not this café's key, or none: nothing of it is read.
      const text = await unseal(raw);
      if (text !== null) {
        plain.set(key, text);
        unreadable.delete(key);
      } else {
        plain.delete(key);
        unreadable.add(key);
      }
      continue;
    }
    plain.set(key, raw);
    if (sealKey) writeKept(key, raw);
  }
}

function readKept(key: string): string | null {
  if (plain.has(key)) return plain.get(key) ?? null;
  try {
    const raw = localStorage.getItem(key);
    return raw && !raw.startsWith(SEALED) ? raw : null;
  } catch {
    return null;
  }
}

/** Kept in memory now, and on the device, sealed, a moment later; false when it cannot be kept. */
function writeKept(key: string, text: string | null): boolean {
  try {
    const raw = localStorage.getItem(key);
    // Sealed, and not yet opened, or not with this key: writing would lose it.
    if ((!opened || unreadable.has(key)) && raw?.startsWith(SEALED)) return false;
    if (text === null) {
      plain.delete(key);
      localStorage.removeItem(key);
      return true;
    }
    if (!sealKey) {
      localStorage.setItem(key, text);
      plain.set(key, text);
      return true;
    }
    plain.set(key, text);
    void seal(text)
      .then((sealed) => {
        // Only the latest is written: a later change has its own.
        if (plain.get(key) === text) localStorage.setItem(key, sealed);
      })
      .catch(() => undefined);
    return true;
  } catch {
    return false;
  }
}

/** This till's own name for itself (0101): random, kept on the device, nothing about anyone. */
export function tillId(): string {
  const KEY = "sixties.pos.tillId";
  try {
    let id = localStorage.getItem(KEY);
    if (!id || !/^[A-Za-z0-9-]{8,64}$/.test(id)) {
      id = `till-${crypto.randomUUID()}`;
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return "till-unknown0";
  }
}

export const OFFLINE_KEY = "sixties.pos.offline.v1";
const COUNTER_KEY = "sixties.pos.offline.no";

/** What this till holds, oldest first; nothing when storage is out of reach. */
export function loadOffline(): OfflineSale[] {
  try {
    const raw = readKept(practiceScoped(OFFLINE_KEY));
    if (!raw) return [];
    const list = JSON.parse(raw) as unknown;
    return Array.isArray(list) ? list.filter(isOfflineSale) : [];
  } catch {
    return [];
  }
}

export function saveOffline(list: OfflineSale[]): boolean {
  return writeKept(practiceScoped(OFFLINE_KEY), list.length === 0 ? null : JSON.stringify(list));
}

/** The next of the till's own numbers for a sale made offline: 1, 2, 3… */
export function nextOfflineNo(list: OfflineSale[]): number {
  let last = 0;
  try {
    last = Number(localStorage.getItem(practiceScoped(COUNTER_KEY)) ?? 0) || 0;
  } catch {
    /* no storage: from what is kept */
  }
  const no = Math.max(last, ...list.map((s) => s.no), 0) + 1;
  try {
    localStorage.setItem(practiceScoped(COUNTER_KEY), String(no));
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
  /** The order's subtotal and who may give what (0101): without them, no discount offline. */
  discounts?: { subtotal: Decimal; rules: DiscountRules },
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
  // A quick sale (0101): the cashier's own discount, within their cap, and the
  // customer chosen before the connection dropped, go with it.
  if (o.discount) {
    if (!discounts) return "A discount needs the internet: take it off to sell offline";
    const needs = discountNeeds(
      { ...o.discount, approval: null },
      discounts.subtotal,
      discounts.rules,
    );
    if (needs === "approval")
      return "A discount over your cap needs a manager, and the internet: lower it, or take it off to sell offline";
  }
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
    const raw = readKept(practiceScoped(KEPT_BILLS_KEY));
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
  return writeKept(practiceScoped(KEPT_BILLS_KEY), list.length === 0 ? null : JSON.stringify(list));
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
