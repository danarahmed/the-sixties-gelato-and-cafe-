/**
 * Pre-orders with deposits (round eighteen, 0076): a cake for Friday, part
 * paid now. The deposit is the customer's money held until it is collected,
 * when it pays its part of the sale; given back, or kept, if it is cancelled.
 */

export type PreOrderStatus = "open" | "collected" | "cancelled";

export interface PreOrderLine {
  variantId: string;
  qty: number;
  price: number;
  note: string | null;
  product: string;
  productAr: string | null;
  productCkb: string | null;
  size: string | null;
}

export interface PreOrder {
  id: string;
  no: number;
  customer: string;
  phone: string | null;
  pickupAt: string;
  channel: string;
  note: string | null;
  status: PreOrderStatus;
  total: number;
  deposit: number;
  depositTender: string | null;
  location: string | null;
  sale: string | null;
  lines: PreOrderLine[];
}

export interface PreOrderList {
  orders: PreOrder[];
  /** The deposits held against the open ones. */
  held: number;
  /** What the books hold in Customer deposits (2300), for those who see them; null otherwise. */
  books: number | null;
}

const n = (v: unknown) => (v == null ? 0 : Number(v));
const s = (v: unknown) => (v == null ? null : String(v));

/** The database's answer, read. */
export function preOrderList(d: unknown): PreOrderList {
  const r = (d ?? {}) as Record<string, unknown>;
  const orders = Array.isArray(r.orders) ? (r.orders as Record<string, unknown>[]) : [];
  return {
    held: n(r.held),
    books: r.books == null ? null : Number(r.books),
    orders: orders.map((o) => ({
      id: String(o.id),
      no: n(o.no),
      customer: String(o.customer ?? ""),
      phone: s(o.phone),
      pickupAt: String(o.pickup_at),
      channel: String(o.channel ?? "takeaway"),
      note: s(o.note),
      status: (String(o.status) as PreOrderStatus) ?? "open",
      total: n(o.total),
      deposit: n(o.deposit),
      depositTender: s(o.deposit_tender),
      location: s(o.location),
      sale: s(o.sale),
      lines: (Array.isArray(o.lines) ? (o.lines as Record<string, unknown>[]) : []).map((l) => ({
        variantId: String(l.variant_id),
        qty: n(l.qty),
        price: n(l.price),
        note: s(l.note),
        product: String(l.product ?? ""),
        productAr: s(l.product_ar),
        productCkb: s(l.product_ckb),
        size: s(l.size),
      })),
    })),
  };
}

/** What is left to pay at collection: the total less the deposit. */
export function leftToPay(o: Pick<PreOrder, "total" | "deposit">): number {
  return Math.max(0, o.total - o.deposit);
}

/** The open ones by the day they are collected, soonest first, as the kitchen reads them. */
export function byPickupDay(
  orders: readonly PreOrder[],
  dayOf: (iso: string) => string,
): { day: string; orders: PreOrder[] }[] {
  const days = new Map<string, PreOrder[]>();
  for (const o of [...orders]
    .filter((x) => x.status === "open")
    .sort((a, b) => a.pickupAt.localeCompare(b.pickupAt) || a.no - b.no)) {
    const d = dayOf(o.pickupAt);
    days.set(d, [...(days.get(d) ?? []), o]);
  }
  return [...days].map(([day, list]) => ({ day, orders: list }));
}

/** A pre-order is late once its time to be collected is more than an hour past. */
export function isLate(o: Pick<PreOrder, "pickupAt" | "status">, now: number): boolean {
  return o.status === "open" && Date.parse(o.pickupAt) < now - 3600_000;
}
