/**
 * The till's working state, shared by its parts. An Order is what the panel
 * on the right shows: either a quick sale at the counter (paid now, through
 * record_sale) or a bill for a table or a customer (paid later, through
 * settle_tab). Money is only displayed here; the database does the sums that
 * are recorded.
 */
import Decimal from "decimal.js";
import type { SalesChannel } from "@domain/sales/recipe.js";
import type { Locale } from "@/lib/i18n/core";
import type { DiningTable, OpenBill, PosItem } from "@/lib/db/pos";
import { isPlatformChannel } from "@/lib/channels";
import { reasonMissing } from "@/lib/reasons";
import { normaliseNumber } from "@/lib/validation";

export type Tender = "cash" | "card" | "platform_paid";

export interface Line {
  /** Stable key for the screen. */
  key: string;
  variantId: string;
  qty: number;
  note: string | null;
  /** The saved line on the bill, which a split moves; null until saved. */
  lineId: string | null;
  /** Name from the bill, for a product no longer on the menu. */
  fallbackName: string | null;
  /**
   * The price the saved bill carries for this product: frozen when the bill
   * was printed (the customer holds it), today's otherwise; null when the
   * saved bill does not have it.
   */
  billPrice: number | null;
}

/** A discount as the cashier gave it: a percentage of the bill, or an amount off it. */
export interface Discount {
  kind: "percent" | "amount";
  /** As typed; Arabic and Kurdish digits are read too. */
  value: string;
  /** Why it is given (0028): a reason from the list; none until one is chosen. */
  reason?: string | null;
  /** In the cashier's own words: what "Other" needs. */
  note?: string;
  /** A manager's approval of a discount over the cap. */
  approval?: Approval | null;
  /**
   * The discount as the saved bill has it: why, who gave it and who approved
   * it. Already checked, it is not asked about again until it is changed.
   */
  kept?: KeptDiscount | null;
}

/** A manager's name and PIN, given on the till: good for one discount up to a share of the bill. */
export interface Approval {
  id: string;
  by: string;
  percent: number;
}

export interface KeptDiscount {
  reason: string | null;
  by: string | null;
  approvedBy: string | null;
}

export interface Order {
  kind: "quick" | "bill";
  tabId: string | null;
  version: number | null;
  tableId: string | null;
  label: string | null;
  channel: SalesChannel;
  lines: Line[];
  discount: Discount | null;
  /** The lines and discount as last saved (see signature); null for a bill never saved. */
  saved: string | null;
  printedAt: string | null;
  printCount: number;
  openedAt: string | null;
  openedBy: string | null;
}

/** A delivery platform's order: paid through the platform, with the number from its tablet. */
export const isPlatform = (c: SalesChannel) => isPlatformChannel(c);

export function signature(lines: Line[], discount: Discount | null): string {
  const d = discount ? parseNumber(discount.value) : null;
  return JSON.stringify([
    lines.map((l) => [l.variantId, l.qty, l.note ?? ""]),
    discount && d ? [discount.kind, d.toString()] : null,
  ]);
}

/** The bill as last saved had something on it (cancelling it then needs a manager). */
export function savedHasItems(o: Order): boolean {
  if (o.saved === null) return false;
  const [lines] = JSON.parse(o.saved) as [unknown[], unknown];
  return lines.length > 0;
}

/** A bill with changes the database does not have yet. */
export function isDirty(o: Order): boolean {
  if (o.kind !== "bill") return false;
  return o.saved === null ? o.lines.length > 0 : signature(o.lines, o.discount) !== o.saved;
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
    discount: null,
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
    billPrice: l.price,
  }));
  const kept: KeptDiscount = {
    reason: b.discountReason ?? null,
    by: b.discountBy ?? null,
    approvedBy: b.discountApprovedBy ?? null,
  };
  const discount: Discount | null =
    b.discountPercent !== null
      ? { kind: "percent", value: String(b.discountPercent), kept }
      : b.discountAmount !== null
        ? { kind: "amount", value: String(b.discountAmount), kept }
        : null;
  return {
    kind: "bill",
    tabId: b.tabId,
    version: b.version,
    tableId: b.tableId,
    label: b.label,
    channel: b.channel,
    lines,
    discount,
    saved: signature(lines, discount),
    printedAt: b.billPrintedAt,
    printCount: b.billPrintCount,
    openedAt: b.openedAt,
    openedBy: b.openedBy,
  };
}

/**
 * Add one of a product: onto a matching line without a note, or as a new line
 * at the price the bill already has for it (a printed bill keeps its price
 * for more of the same, as the database does).
 */
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
      billPrice:
        lines.find((l) => l.variantId === variantId && l.billPrice !== null)?.billPrice ?? null,
    },
  ];
}

/**
 * The saved bill on screen is not the one the database now has: another
 * till changed it, it was printed, or a price on it changed (a new price
 * started at midnight, say).
 */
export function billChanged(o: Order, b: OpenBill): boolean {
  return (
    b.version !== o.version ||
    b.billPrintedAt !== o.printedAt ||
    b.billPrintCount !== o.printCount ||
    b.lines.length !== o.lines.length ||
    b.lines.some((l, i) => l.lineId !== o.lines[i]!.lineId || l.price !== o.lines[i]!.billPrice)
  );
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

/** A saved bill's line at the bill's price (the printed one, once printed); otherwise the menu's. */
export function linePrice(
  l: Line,
  byId: Map<string, PosItem>,
  channel: SalesChannel,
): number | null {
  if (l.billPrice !== null) return l.billPrice;
  const p = byId.get(l.variantId)?.prices[channel];
  return p === undefined ? null : p;
}

export function lineAmount(
  l: Line,
  byId: Map<string, PosItem>,
  channel: SalesChannel,
): Decimal | null {
  const p = linePrice(l, byId, channel);
  return p === null ? null : new Decimal(p).times(l.qty);
}

// ------------------------------------------------------------------ money
/** A number as staff type it, in any of the three scripts; null if it is not one. */
export function parseNumber(v: string): Decimal | null {
  const s = normaliseNumber(v);
  return /^\d+(\.\d+)?$/.test(s) ? new Decimal(s) : null;
}

/** How the business rounds money, as the database does it. */
export interface MoneyRules {
  /** The currency's decimals (0 for IQD): every amount is rounded to this. */
  decimals: number;
  /** A percentage discount comes to the nearest multiple of this (500 IQD). */
  discountStep: number;
}

/** Rounded as the database rounds money (money_round): to the currency unit, halves to even. */
export function roundMoney(d: Decimal, decimals: number): Decimal {
  return d.toDecimalPlaces(decimals, Decimal.ROUND_HALF_EVEN);
}

/** To the nearest multiple of step, exactly half-way up, as sale_discount does it. */
export function roundToStep(d: Decimal, step: number): Decimal {
  return step > 0 ? d.div(step).plus(0.5).floor().times(step) : d;
}

/** True when a discount cannot be given as typed: not a number, zero, or over 100%. */
export function discountInvalid(d: Discount | null): boolean {
  if (!d) return false;
  const v = parseNumber(d.value);
  return !v || v.lte(0) || (d.kind === "percent" && v.gt(100));
}

/** The bill before any discount, each line rounded as the database rounds it. */
export function orderSubtotal(o: Order, byId: Map<string, PosItem>, money: MoneyRules): Decimal {
  return o.lines.reduce((sum, l) => {
    const a = lineAmount(l, byId, o.channel);
    return a === null ? sum : sum.plus(roundMoney(a, money.decimals));
  }, new Decimal(0));
}

/**
 * What a discount comes to on a bill, worked out exactly as the database does
 * (sale_discount): a percentage of the bill rounded to the business's step
 * (47% of 8,500 is 3,995, given as 4,000), or an amount as typed, and never
 * more than the bill.
 */
export function discountAmount(d: Discount | null, subtotal: Decimal, money: MoneyRules): Decimal {
  if (!d || discountInvalid(d)) return new Decimal(0);
  const v = parseNumber(d.value)!;
  const raw =
    d.kind === "percent" ? roundToStep(subtotal.times(v).div(100), money.discountStep) : v;
  return Decimal.min(roundMoney(raw, money.decimals), Decimal.max(subtotal, 0));
}

/** An amount as a percentage of the bill, to two places, for showing beside it. */
export function percentOf(amount: Decimal, subtotal: Decimal): string {
  if (subtotal.lte(0)) return "";
  return amount.div(subtotal).times(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toString();
}

/** What the customer pays: the bill less its discount. */
export function orderDue(o: Order, byId: Map<string, PosItem>, money: MoneyRules): Decimal {
  const sub = orderSubtotal(o, byId, money);
  return sub.minus(discountAmount(o.discount, sub, money));
}

/** The discount as the database takes it: one of the two, as a plain number. */
export function discountParams(d: Discount | null): {
  discountPercent: string | null;
  discountAmount: string | null;
} {
  if (!d || discountInvalid(d)) return { discountPercent: null, discountAmount: null };
  const v = normaliseNumber(d.value);
  return d.kind === "percent"
    ? { discountPercent: v, discountAmount: null }
    : { discountPercent: null, discountAmount: v };
}

/**
 * The share of the bill a discount comes to, as the database judges it
 * against the cap (discount_share, 0028): a percentage as it was asked —
 * rounding it to the step is the business's doing, not the cashier's — and an
 * amount as the part of the bill it takes off. To two places.
 */
export function discountShare(d: Discount | null, subtotal: Decimal): Decimal {
  if (!d || discountInvalid(d)) return new Decimal(0);
  const v = parseNumber(d.value)!;
  const share =
    d.kind === "percent"
      ? v
      : subtotal.gt(0)
        ? Decimal.min(v, subtotal).div(subtotal).times(100)
        : new Decimal(0);
  return share.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

/** Who may give what on their own (0028). */
export interface DiscountRules {
  /** Above this share of the bill, a discount needs a manager's approval… */
  cap: number;
  /** …unless whoever gives it approves discounts themselves. */
  canApprove: boolean;
}

/**
 * What a discount still needs before it can be given: a reason from the
 * list, the words "Other" needs, or — over the cap — a manager's approval
 * that covers it. Null when nothing (a discount already on the bill included).
 */
export function discountNeeds(
  d: Discount | null,
  subtotal: Decimal,
  rules: DiscountRules,
): "reason" | "note" | "approval" | null {
  if (!d || discountInvalid(d) || d.kept) return null;
  const missing = reasonMissing(d.reason ?? null, d.note ?? "");
  if (missing) return missing === "choose" ? "reason" : "note";
  const share = discountShare(d, subtotal);
  if (rules.canApprove || share.lte(rules.cap)) return null;
  return d.approval && share.lte(d.approval.percent) ? null : "approval";
}

/** The share a manager is asked to approve: the discount's, up to the next whole percent. */
export function approvalPercent(d: Discount | null, subtotal: Decimal): number {
  return discountShare(d, subtotal).ceil().toNumber();
}

/**
 * The database refused the approval sent with a discount: used already, run
 * out, given to someone else, or for less than the discount. The till drops it
 * and asks again.
 */
export function approvalRefused(error: string): boolean {
  return /That approval (has been used|has run out|was given to someone else|is not for this)|The manager approved up to/.test(
    error,
  );
}

/** Why the discount is given, as the database takes it; nothing again for one already on the bill. */
export function discountWhy(d: Discount | null): {
  discountReason: string | null;
  discountNote: string | null;
  approvalId: string | null;
} {
  if (!d || discountInvalid(d) || d.kept)
    return { discountReason: null, discountNote: null, approvalId: null };
  return {
    discountReason: d.reason ?? null,
    discountNote: d.note?.trim() || null,
    approvalId: d.approval?.id ?? null,
  };
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
    .replace(/[\u0300-\u036f\u064b-\u065f\u0670]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/[ىی]/g, "ي")
    .replace(/[ك]/g, "ک")
    .trim();
}
