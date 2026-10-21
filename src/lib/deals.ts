/**
 * Meal deals and prices by the time of day (0089), as the screens read them.
 * Shared by the server's readers and the till, which works out a deal's
 * total as the database does (model.ts, dealAmount).
 */
export interface DealSlot {
  label: string | null;
  categoryId: string | null;
  /** The sizes named for it. */
  variants: string[];
  /** Every size it takes: those named and those of its category on sale. */
  sizes: string[];
}

export interface Deal {
  id: string;
  name: string;
  nameAr: string | null;
  nameCkb: string | null;
  isActive: boolean;
  /** Monday 1 to Sunday 7; null: every day. */
  days: number[] | null;
  starts: string | null;
  ends: string | null;
  onNow: boolean;
  prices: Record<string, number>;
  slots: DealSlot[];
  sold: number;
}

export interface TimePrice {
  id: string;
  variantId: string;
  product: string;
  /** Null: dine-in and take-away. */
  channel: string | null;
  locationId: string | null;
  location: string | null;
  days: number[] | null;
  starts: string;
  ends: string;
  price: number;
  /** The channel's own price, for comparing. */
  usual: number | null;
  onNow: boolean;
}

export interface DealReportRow {
  dealId: string;
  name: string;
  sold: number;
  full: number;
  paid: number;
  given: number;
}

type Row = Record<string, unknown>;
const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const sn = (v: unknown) => (v === null || v === undefined || v === "" ? null : String(v));
const n = (v: unknown) => (v === null || v === undefined || v === "" ? 0 : Number(v));
const days = (v: unknown) => (Array.isArray(v) ? v.map(Number) : null);
const ids = (v: unknown) => (Array.isArray(v) ? v.map(String) : []);

export function dealsFrom(data: unknown): Deal[] {
  return (Array.isArray(data) ? (data as Row[]) : []).map((r) => ({
    id: s(r.id),
    name: s(r.name),
    nameAr: sn(r.name_ar),
    nameCkb: sn(r.name_ckb),
    isActive: r.is_active !== false,
    days: days(r.days),
    starts: sn(r.starts),
    ends: sn(r.ends),
    onNow: r.on_now === true,
    prices: Object.fromEntries(
      Object.entries((r.prices ?? {}) as Record<string, unknown>).map(([k, v]) => [k, n(v)]),
    ),
    slots: (Array.isArray(r.slots) ? (r.slots as Row[]) : []).map((x) => ({
      label: sn(x.label),
      categoryId: sn(x.category_id),
      variants: ids(x.variants),
      sizes: ids(x.sizes),
    })),
    sold: n(r.sold),
  }));
}

export function timePricesFrom(data: unknown): TimePrice[] {
  return (Array.isArray(data) ? (data as Row[]) : []).map((r) => ({
    id: s(r.id),
    variantId: s(r.variant_id),
    product: s(r.product),
    channel: sn(r.channel),
    locationId: sn(r.location_id),
    location: sn(r.location),
    days: days(r.days),
    starts: s(r.starts),
    ends: s(r.ends),
    price: n(r.price),
    usual: r.usual === null || r.usual === undefined ? null : Number(r.usual),
    onNow: r.on_now === true,
  }));
}

/** A deal's name in the reader's language, when it has one there. */
export function dealName(
  d: { name: string; nameAr: string | null; nameCkb: string | null },
  locale: string,
) {
  if (locale === "ar" && d.nameAr) return d.nameAr;
  if (locale === "ckb" && d.nameCkb) return d.nameCkb;
  return d.name;
}

/** The days of the week, Monday 1 first, as the screens name them (phrases). */
export const WEEKDAYS: [number, string][] = [
  [1, "Monday"],
  [2, "Tuesday"],
  [3, "Wednesday"],
  [4, "Thursday"],
  [5, "Friday"],
  [6, "Saturday"],
  [7, "Sunday"],
];
