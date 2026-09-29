import "server-only";
import type { SalesChannel } from "@domain/sales/recipe.js";
import { db, num, numOrNull, rows, str, strOrNull, type Row } from "@/lib/db/client";

/** One thing the till sells, at today's prices — never its cost. */
export interface PosItem {
  variantId: string;
  productId: string;
  productName: string;
  variantName: string;
  nameAr: string | null;
  nameCkb: string | null;
  category: string | null;
  categoryId: string | null;
  categorySort: number | null;
  categoryAr: string | null;
  categoryCkb: string | null;
  imageUrl: string | null;
  isFavourite: boolean;
  prices: Record<string, number>;
}

/** An add-on on the till (0041): its names, and its price today on each channel it sells on. */
export interface PosAddon {
  id: string;
  groupId: string;
  name: string;
  nameAr: string | null;
  nameCkb: string | null;
  prices: Record<string, number>;
}

/** A group of add-ons: the fewest and the most a line takes from it (Milk: one; Extras: up to three). */
export interface PosAddonGroup {
  id: string;
  name: string;
  nameAr: string | null;
  nameCkb: string | null;
  min: number;
  max: number | null;
  addons: PosAddon[];
}

/** The till's add-ons: each group in its order, and which products (or sizes) offer which. */
export interface PosAddons {
  groups: PosAddonGroup[];
  offers: { productId: string; variantId: string | null; groupId: string }[];
}

export const NO_ADDONS: PosAddons = { groups: [], offers: [] };

export function parsePosAddons(data: unknown): PosAddons {
  const d = (data && typeof data === "object" ? data : {}) as Row;
  const groups = (Array.isArray(d.groups) ? (d.groups as Row[]) : []).map((g) => ({
    id: str(g.id),
    name: str(g.name),
    nameAr: strOrNull(g.name_ar),
    nameCkb: strOrNull(g.name_ckb),
    min: num(g.min),
    max: numOrNull(g.max),
    addons: (Array.isArray(g.modifiers) ? (g.modifiers as Row[]) : []).map((m) => {
      const prices: Record<string, number> = {};
      for (const [k, v] of Object.entries((m.prices as Record<string, unknown>) ?? {}))
        prices[k] = num(v);
      return {
        id: str(m.id),
        groupId: str(g.id),
        name: str(m.name),
        nameAr: strOrNull(m.name_ar),
        nameCkb: strOrNull(m.name_ckb),
        prices,
      };
    }),
  }));
  const offers = (Array.isArray(d.offers) ? (d.offers as Row[]) : []).map((o) => ({
    productId: str(o.product_id),
    variantId: strOrNull(o.variant_id),
    groupId: str(o.group_id),
  }));
  return { groups, offers };
}

/** The till's add-ons at today's prices (0041) — never their cost. */
export async function getPosAddons(): Promise<PosAddons> {
  const c = await db();
  const r = await c.rpc("pos_addons");
  if (r.error) throw new Error(r.error.message);
  return parsePosAddons(r.data);
}

/** The till's menu: categories in their order, then products by name. */
export async function getPosCatalogue(): Promise<PosItem[]> {
  const c = await db();
  return rows(await c.rpc("pos_catalogue"), "the menu").map((r: Row) => {
    const prices: Record<string, number> = {};
    for (const [k, v] of Object.entries((r.prices as Record<string, unknown>) ?? {}))
      prices[k] = num(v);
    return {
      variantId: str(r.variant_id),
      productId: str(r.product_id),
      productName: str(r.product_name),
      variantName: str(r.variant_name),
      nameAr: strOrNull(r.name_ar),
      nameCkb: strOrNull(r.name_ckb),
      category: strOrNull(r.category),
      categoryId: strOrNull(r.category_id),
      categorySort: numOrNull(r.category_sort),
      categoryAr: strOrNull(r.category_ar),
      categoryCkb: strOrNull(r.category_ckb),
      imageUrl: strOrNull(r.image_url),
      isFavourite: r.is_favourite === true,
      prices,
    };
  });
}

export interface DiningTable {
  id: string;
  name: string;
  area: string | null;
  seats: number | null;
  sortOrder: number;
  isActive: boolean;
}

/** Every table, in use or not (the floor shows those in use; managers edit all). */
export async function getTables(): Promise<DiningTable[]> {
  const c = await db();
  const res = await c
    .from("dining_table")
    .select("id,name,area,seats,sort_order,is_active")
    .order("sort_order")
    .order("name");
  return rows(res, "the tables").map((r: Row) => ({
    id: str(r.id),
    name: str(r.name),
    area: strOrNull(r.area),
    seats: numOrNull(r.seats),
    sortOrder: num(r.sort_order),
    isActive: r.is_active === true,
  }));
}

export interface OpenBillLine {
  lineId: string;
  variantId: string;
  qty: number;
  note: string | null;
  productName: string;
  variantName: string;
  /** Today's price on the bill's channel; null if it no longer has one. */
  price: number | null;
  /** Its add-ons (0041), each at the bill's price for it (frozen once printed). */
  modifiers: OpenBillAddon[];
}

/** An add-on on a bill's line: how many for each one of the line, at what price. */
export interface OpenBillAddon {
  modifierId: string;
  name: string;
  nameAr: string | null;
  nameCkb: string | null;
  qty: number;
  price: number | null;
}

/** A bill still waiting for its money. */
export interface OpenBill {
  tabId: string;
  version: number;
  tableId: string | null;
  tableName: string | null;
  label: string | null;
  channel: SalesChannel;
  businessDay: string;
  openedAt: string;
  openedBy: string | null;
  billPrintedAt: string | null;
  billPrintCount: number;
  lines: OpenBillLine[];
  /** Before the discount. */
  subtotal: number;
  /** What the discount comes to today. */
  discount: number;
  /** The discount as given: a percentage or an amount (at most one). */
  discountPercent: number | null;
  discountAmount: number | null;
  /** Why it was given, who gave it and who approved it (0028); unknown for one given before. */
  discountReason?: string | null;
  discountBy?: string | null;
  discountApprovedBy?: string | null;
  /** What the customer owes: the bill less its discount. */
  total: number;
  /** Its turn number, for the barista's ticket (0034); none on a bill opened before. */
  turnNo?: number | null;
  /** Its customer, their points, and where its delivery goes (0050). */
  customer?: BillCustomer | null;
}

/** A bill's customer as the till shows them. */
export interface BillCustomer {
  id: string;
  name: string;
  phone: string;
  points: number;
  addressId: string | null;
  /** The address as the bill was saved with it. */
  address: string | null;
}

export function parseOpenBills(data: unknown): OpenBill[] {
  return (Array.isArray(data) ? data : []).map((r: Row) => ({
    tabId: str(r.tab_id),
    version: num(r.version),
    tableId: strOrNull(r.table_id),
    tableName: strOrNull(r.table_name),
    label: strOrNull(r.label),
    channel: str(r.channel) as SalesChannel,
    businessDay: str(r.business_day),
    openedAt: str(r.opened_at),
    openedBy: strOrNull(r.opened_by),
    billPrintedAt: strOrNull(r.bill_printed_at),
    billPrintCount: num(r.bill_print_count),
    lines: (Array.isArray(r.lines) ? (r.lines as Row[]) : []).map((l) => ({
      lineId: str(l.line_id),
      variantId: str(l.variant_id),
      qty: num(l.qty),
      note: strOrNull(l.note),
      productName: str(l.product_name),
      variantName: str(l.variant_name),
      price: numOrNull(l.price),
      modifiers: (Array.isArray(l.modifiers) ? (l.modifiers as Row[]) : []).map((m) => ({
        modifierId: str(m.modifier_id),
        name: str(m.name),
        nameAr: strOrNull(m.name_ar),
        nameCkb: strOrNull(m.name_ckb),
        qty: num(m.qty),
        price: numOrNull(m.price),
      })),
    })),
    subtotal: num(r.subtotal),
    discount: num(r.discount),
    discountPercent: numOrNull(r.discount_percent),
    discountAmount: numOrNull(r.discount_amount),
    discountReason: strOrNull(r.discount_reason),
    discountBy: strOrNull(r.discount_by),
    discountApprovedBy: strOrNull(r.discount_approved_by),
    total: num(r.total),
    turnNo: numOrNull(r.turn_no),
    customer: r.customer_id
      ? {
          id: str(r.customer_id),
          name: str(r.customer_name),
          phone: str(r.customer_phone),
          points: num(r.customer_points),
          addressId: strOrNull(r.customer_address_id),
          address: strOrNull(r.delivery_address),
        }
      : null,
  }));
}

export async function getOpenBills(): Promise<OpenBill[]> {
  const c = await db();
  return parseOpenBills(rows(await c.rpc("pos_open_bills"), "the open bills"));
}
