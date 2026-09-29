/**
 * Customers and loyalty (0050, release X): the shapes the screens read and
 * the words they give them. Pure: the pages, the till and the tests read
 * through here.
 */

/** A customer's address, for the café's own deliveries. */
export interface CustomerAddress {
  id: string;
  label: string | null;
  address: string;
  directions: string | null;
  active: boolean;
}

/** A customer as the till shows them: who they are, their points, and the rewards they come to. */
export interface TillCustomer {
  id: string;
  name: string;
  phone: string;
  notes: string | null;
  active: boolean;
  points: number;
  /** How many rewards the points come to now (none while loyalty is off). */
  rewards: number;
  rewardPoints: number;
  rewardValue: number;
  /** Loyalty is on (Settings). */
  loyalty: boolean;
  addresses: CustomerAddress[];
}

export function tillCustomerFrom(v: unknown): TillCustomer | null {
  const r = obj(v);
  if (!r.id) return null;
  return {
    id: str(r.id),
    name: str(r.name),
    phone: str(r.phone),
    notes: strOrNull(r.notes),
    active: r.active !== false,
    points: num(r.points),
    rewards: num(r.rewards),
    rewardPoints: num(r.reward_points),
    rewardValue: num(r.reward_value),
    loyalty: r.loyalty !== false,
    addresses: addressesFrom(r.addresses),
  };
}

function addressesFrom(v: unknown): CustomerAddress[] {
  return list(v).map((a) => ({
    id: str(a.id),
    label: strOrNull(a.label),
    address: str(a.address),
    directions: strOrNull(a.directions),
    active: a.active !== false,
  }));
}

/** What a sale did for its customer, as the database answered it. */
export interface SaleCustomer {
  customerId: string;
  name: string;
  earned: number;
  spent: number;
  /** Their points now. */
  points: number;
}

export function saleCustomerFrom(v: unknown): SaleCustomer | null {
  const r = obj(v);
  if (!r.customer_id) return null;
  return {
    customerId: str(r.customer_id),
    name: str(r.name),
    earned: num(r.earned),
    spent: num(r.spent),
    points: num(r.points),
  };
}

/** One customer on Customers. */
export interface CustomerRow {
  id: string;
  name: string;
  phone: string;
  notes: string | null;
  active: boolean;
  createdAt: string;
  points: number;
  orders: number;
  /** What their sales came to, less what was given back; voids left out. */
  spent: number;
  lastOrderAt: string | null;
  addresses: number;
}

export function customerRowsFrom(v: unknown): CustomerRow[] {
  return list(v).map((r) => ({
    id: str(r.id),
    name: str(r.name),
    phone: str(r.phone),
    notes: strOrNull(r.notes),
    active: r.active !== false,
    createdAt: str(r.created_at),
    points: num(r.points),
    orders: num(r.orders),
    spent: num(r.spent),
    lastOrderAt: strOrNull(r.last_order_at),
    addresses: num(r.addresses),
  }));
}

/** How a customer's points moved. */
export const LOYALTY_KINDS = ["earn", "redeem", "earn_back", "redeem_back", "adjust"] as const;
export type LoyaltyKind = (typeof LOYALTY_KINDS)[number];

/** How points moved, as a customer's page names it: phrases, shown through t(). */
export const LOYALTY_KIND_LABEL: Record<LoyaltyKind, string> = {
  earn: "Earned on a sale",
  redeem: "A reward taken",
  earn_back: "Taken back: sale voided or refunded",
  redeem_back: "Given back: sale voided or refunded",
  adjust: "Given or taken by hand",
};

export interface CustomerOrder {
  orderId: string;
  placedAt: string;
  channel: string;
  status: string;
  turnNo: number | null;
  gross: number;
  discount: number;
  net: number;
  refunded: number;
  deliveryAddress: string | null;
  earned: number;
  spent: number;
}

export interface LoyaltyEntry {
  id: string;
  at: string;
  kind: LoyaltyKind;
  points: number;
  /** What a reward took off. */
  value: number | null;
  orderId: string | null;
  refundNo: number | null;
  reason: string | null;
  by: string | null;
}

export interface CustomerDetail {
  id: string;
  name: string;
  phone: string;
  notes: string | null;
  active: boolean;
  createdAt: string;
  createdBy: string | null;
  points: number;
  addresses: CustomerAddress[];
  orders: CustomerOrder[];
  ledger: LoyaltyEntry[];
}

export function customerDetailFrom(v: unknown): CustomerDetail | null {
  const r = obj(v);
  const c = obj(r.customer);
  if (!c.id) return null;
  return {
    id: str(c.id),
    name: str(c.name),
    phone: str(c.phone),
    notes: strOrNull(c.notes),
    active: c.active !== false,
    createdAt: str(c.created_at),
    createdBy: strOrNull(c.created_by),
    points: num(r.points),
    addresses: addressesFrom(r.addresses),
    orders: list(r.orders).map((o) => ({
      orderId: str(o.order_id),
      placedAt: str(o.placed_at),
      channel: str(o.channel),
      status: str(o.status),
      turnNo: numOrNull(o.turn_no),
      gross: num(o.gross),
      discount: num(o.discount),
      net: num(o.net),
      refunded: num(o.refunded),
      deliveryAddress: strOrNull(o.delivery_address),
      earned: num(o.earned),
      spent: num(o.spent),
    })),
    ledger: list(r.ledger).map((l) => ({
      id: str(l.id),
      at: str(l.at),
      kind: LOYALTY_KINDS.includes(l.kind as LoyaltyKind) ? (l.kind as LoyaltyKind) : "adjust",
      points: num(l.points),
      value: numOrNull(l.value),
      orderId: strOrNull(l.order_id),
      refundNo: numOrNull(l.refund_no),
      reason: strOrNull(l.reason),
      by: strOrNull(l.by),
    })),
  };
}

/** The loyalty report (Reports → Customers). */
export interface CustomerReport {
  points: {
    earned: number;
    spent: number;
    takenBack: number;
    givenBack: number;
    givenByHand: number;
    takenByHand: number;
    rewards: number;
    rewardsValue: number;
  };
  /** The points customers hold now, and what they would take off. */
  outstanding: number;
  outstandingValue: number;
  customers: number;
  newCustomers: number;
  sales: { orders: number; net: number };
  top: { customerId: string; name: string; orders: number; spent: number; points: number }[];
}

export function customerReportFrom(v: unknown): CustomerReport {
  const r = obj(v);
  const p = obj(r.points);
  const s = obj(r.sales);
  return {
    points: {
      earned: num(p.earned),
      spent: num(p.spent),
      takenBack: num(p.taken_back),
      givenBack: num(p.given_back),
      givenByHand: num(p.given_by_hand),
      takenByHand: num(p.taken_by_hand),
      rewards: num(p.rewards),
      rewardsValue: num(p.rewards_value),
    },
    outstanding: num(r.outstanding),
    outstandingValue: num(r.outstanding_value),
    customers: num(r.customers),
    newCustomers: num(r.new_customers),
    sales: { orders: num(s.orders), net: num(s.net) },
    top: list(r.top).map((t) => ({
      customerId: str(t.customer_id),
      name: str(t.name),
      orders: num(t.orders),
      spent: num(t.spent),
      points: num(t.points),
    })),
  };
}

/**
 * A phone number as the café reads it: +9647701234567 is 0770 123 4567, a
 * landline +964531234567 is 053 123 4567; a number from abroad as it is kept.
 */
export function phoneText(phone: string): string {
  const m = /^\+964(\d+)$/.exec(phone);
  if (!m) return phone;
  const local = `0${m[1]}`;
  if (local.length === 11) return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;
  if (local.length === 10) return `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
  return local;
}

/** An address as a delivery slip gives it: where, then how to find it. */
export function addressText(a: Pick<CustomerAddress, "address" | "directions">): string {
  return a.directions ? `${a.address} (${a.directions})` : a.address;
}

/**
 * What rewards take off a bill. A reward is taken whole: the bill must come to
 * at least what the rewards take off, and a reward is the bill's only discount.
 */
export function rewardOff(
  total: number,
  rewards: number,
  value: number,
): { off: number; ok: boolean } {
  const off = Math.max(0, Math.floor(rewards)) * value;
  return { off, ok: off <= total };
}

const num = (v: unknown): number => {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const numOrNull = (v: unknown): number | null =>
  v === null || v === undefined || v === "" ? null : num(v);
const str = (v: unknown): string => (v === null || v === undefined ? "" : String(v));
const strOrNull = (v: unknown): string | null =>
  v === null || v === undefined || v === "" ? null : String(v);
const list = (v: unknown): Record<string, unknown>[] =>
  Array.isArray(v) ? (v as Record<string, unknown>[]) : [];
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

/** Every word this file gives a screen: each is a phrase in the books. */
export const CUSTOMER_PHRASES: readonly string[] = [...Object.values(LOYALTY_KIND_LABEL)];
