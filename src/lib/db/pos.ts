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
  total: number;
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
    })),
    total: num(r.total),
  }));
}

export async function getOpenBills(): Promise<OpenBill[]> {
  const c = await db();
  return parseOpenBills(rows(await c.rpc("pos_open_bills"), "the open bills"));
}
