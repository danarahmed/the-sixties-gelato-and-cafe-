/**
 * The till's working state, shared by its parts. An Order is what the panel
 * on the right shows: either a quick sale at the counter (paid now, through
 * record_sale) or a bill for a table or a customer (paid later, through
 * settle_tab). Money is only displayed here; the database does the sums that
 * are recorded.
 */
import Decimal from "decimal.js";
import type { SalesChannel } from "@domain/sales/recipe.js";
import type { Locale } from "@/lib/i18n/dictionaries";
import type { DiningTable, OpenBill, PosItem } from "@/lib/db/pos";
import { PLATFORM_CHANNELS } from "@/lib/format";

export type Tender = "cash" | "card" | "platform_paid";

export interface Line {
  /** Stable key for the screen. */
  key: string;
  variantId: string;
  qty: number;
  note: string | null;
  /** The saved line on the bill, which a split moves; null until saved. */
  lineId: string | null;
  /** Name and price from the bill, for a product no longer on the menu. */
  fallbackName: string | null;
  fallbackPrice: number | null;
}

export interface Order {
  kind: "quick" | "bill";
  tabId: string | null;
  version: number | null;
  tableId: string | null;
  label: string | null;
  channel: SalesChannel;
  lines: Line[];
  /** The lines as last saved (see signature); null for a bill never saved. */
  saved: string | null;
  printedAt: string | null;
  printCount: number;
  openedAt: string | null;
  openedBy: string | null;
}

export const isPlatform = (c: SalesChannel) => PLATFORM_CHANNELS.includes(c);

export function signature(lines: Line[]): string {
  return JSON.stringify(lines.map((l) => [l.variantId, l.qty, l.note ?? ""]));
}

/** A bill with changes the database does not have yet. */
export function isDirty(o: Order): boolean {
  if (o.kind !== "bill") return false;
  return o.saved === null ? o.lines.length > 0 : signature(o.lines) !== o.saved;
}

let seq = 0;
export const lineKey = () => `n${++seq}`;

export function quickOrder(channel: SalesChannel): Order {
  return {
    kind: "quick",
    tabId: null,
    version: null,
    tableId: null,
    label: null,
    channel,
    lines: [],
    saved: null,
    printedAt: null,
    printCount: 0,
    openedAt: null,
    openedBy: null,
  };
}

export function newBill(
  table: DiningTable | null,
  label: string | null,
  channel: SalesChannel,
): Order {
  return { ...quickOrder(channel), kind: "bill", tableId: table?.id ?? null, label };
}

export function orderFromBill(b: OpenBill): Order {
  const lines: Line[] = b.lines.map((l) => ({
    key: l.lineId,
    variantId: l.variantId,
    qty: l.qty,
    note: l.note,
    lineId: l.lineId,
    fallbackName:
      l.variantName && l.variantName !== l.productName
        ? `${l.productName} — ${l.variantName}`
        : l.productName,
    fallbackPrice: l.price,
  }));
  return {
    kind: "bill",
    tabId: b.tabId,
    version: b.version,
    tableId: b.tableId,
    label: b.label,
    channel: b.channel,
    lines,
    saved: signature(lines),
    printedAt: b.billPrintedAt,
    printCount: b.billPrintCount,
    openedAt: b.openedAt,
    openedBy: b.openedBy,
  };
}

/** Add one of a product: onto a matching line without a note, or as a new line. */
export function addLine(lines: Line[], variantId: string): Line[] {
  let i = lines.length - 1;
  while (i >= 0 && !(lines[i]!.variantId === variantId && !lines[i]!.note)) i--;
  if (i >= 0) return lines.map((l, j) => (j === i ? { ...l, qty: l.qty + 1 } : l));
  return [
    ...lines,
    {
      key: lineKey(),
      variantId,
      qty: 1,
      note: null,
      lineId: null,
      fallbackName: null,
      fallbackPrice: null,
    },
  ];
}

// ------------------------------------------------------------------ names
function inLocale(en: string, ar: string | null, ckb: string | null, locale: Locale): string {
  if (locale === "ar" && ar) return ar;
  if (locale === "ckb" && ckb) return ckb;
  return en;
}

export function productName(i: PosItem, locale: Locale): string {
  return inLocale(i.productName, i.nameAr, i.nameCkb, locale);
}

/** Size or flavour, when a product is sold in more than one. */
export function variantLabel(i: PosItem): string | null {
  return i.variantName && i.variantName !== i.productName ? i.variantName : null;
}

export function itemName(i: PosItem, locale: Locale): string {
  const v = variantLabel(i);
  return v ? `${productName(i, locale)} — ${v}` : productName(i, locale);
}

export function categoryName(i: PosItem, locale: Locale): string | null {
  return i.category ? inLocale(i.category, i.categoryAr, i.categoryCkb, locale) : null;
}

export function lineName(l: Line, byId: Map<string, PosItem>, locale: Locale): string {
  const i = byId.get(l.variantId);
  return i ? itemName(i, locale) : (l.fallbackName ?? "—");
}

export function linePrice(
  l: Line,
  byId: Map<string, PosItem>,
  channel: SalesChannel,
): number | null {
  const p = byId.get(l.variantId)?.prices[channel];
  return p === undefined ? l.fallbackPrice : p;
}

export function lineAmount(
  l: Line,
  byId: Map<string, PosItem>,
  channel: SalesChannel,
): Decimal | null {
  const p = linePrice(l, byId, channel);
  return p === null ? null : new Decimal(p).times(l.qty);
}

export function orderTotal(o: Order, byId: Map<string, PosItem>): Decimal {
  return o.lines.reduce((sum, l) => sum.plus(lineAmount(l, byId, o.channel) ?? 0), new Decimal(0));
}

export function itemCount(o: Order): number {
  return o.lines.reduce((n, l) => n + l.qty, 0);
}

/** What a bill is called on the screen and on paper. */
export function billTitle(
  o: { tableId: string | null; label: string | null },
  tables: DiningTable[],
  fallback: string,
): string {
  const table = o.tableId ? tables.find((t) => t.id === o.tableId)?.name : null;
  if (table && o.label) return `${table} · ${o.label}`;
  return table ?? o.label ?? fallback;
}

/** Minutes since a moment, for "open 12 min". */
export function minutesSince(iso: string | null, now: number): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? Math.max(0, Math.floor((now - t) / 60000)) : null;
}

/** Search that forgives case, Arabic letter forms and diacritics. */
export function fold(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ًͯ-ٰٟ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/[ىی]/g, "ي")
    .replace(/[ك]/g, "ک")
    .trim();
}
