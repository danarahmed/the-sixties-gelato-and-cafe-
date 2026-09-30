/**
 * Find a sale (the September audit's P2-20, "hard to find things"): what was
 * typed on Orders, read as each way a sale is named on paper or by a caller.
 * Pure: the screen and the tests both read through here.
 *
 *  - the receipt's sale number: the 8 letters and digits printed after "Sale"
 *    (the start of the sale's id), or the whole id;
 *  - a number: the sale's journal or a refund's journal, or a refund's own
 *    number;
 *  - the platform's order number, as its tablet shows it;
 *  - the customer: part of their name, or their phone typed any way.
 *
 * A number may be several of these at once (12345678 is a sale number, a
 * journal number and an order number): each is looked for.
 */
import { cleanOrderNo, ORDER_NO } from "@/lib/validation";

export interface SaleQuery {
  /** The receipt's sale number: the ids from `from` to `to`. */
  ids?: { from: string; to: string };
  /** A journal's number, or a refund's. */
  number?: number;
  /** The platform's order number, matched whatever its capitals. */
  platformOrder?: string;
  /** Part of a customer's name. */
  name?: string;
  /** The end of a customer's phone: its digits after 0 or +964. */
  phoneTail?: string;
}

/** The longest search read: a name, a phone or an order number is shorter. */
export const SALE_QUERY_MAX = 60;

const HEX8 = /^[0-9a-f]{8}$/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Arabic-Indic and Eastern Arabic-Indic digits as 0–9. */
function latinDigits(s: string): string {
  return s
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

/**
 * The end of a phone number as the café keeps it (+9647701234567): what was
 * typed, its spaces and dashes gone, less a leading 00964, +964, 964 or 0.
 * Null when it is not seven digits or more.
 */
export function phoneTail(input: string): string | null {
  const v = latinDigits(input).replace(/[\s()./-]/g, "");
  if (!/^\+?\d+$/.test(v)) return null;
  const tail = v.replace(/^\+/, "").replace(/^(00964|964|0)/, "");
  return tail.length >= 7 ? tail : null;
}

/** What was typed on Orders, read as every way it can name a sale; null when nothing is. */
export function readSaleQuery(input: string | null | undefined): SaleQuery | null {
  const text = latinDigits(String(input ?? ""))
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^#+\s*/, "");
  if (!text || text.length > SALE_QUERY_MAX) return null;
  const q: SaleQuery = {};
  if (UUID.test(text)) q.ids = { from: text.toLowerCase(), to: text.toLowerCase() };
  else if (HEX8.test(text)) {
    const h = text.toLowerCase();
    q.ids = { from: `${h}-0000-0000-0000-000000000000`, to: `${h}-ffff-ffff-ffff-ffffffffffff` };
  }
  if (/^\d{1,9}$/.test(text)) q.number = Number(text);
  const order = cleanOrderNo(text);
  if (order && ORDER_NO.test(order)) q.platformOrder = order;
  const tail = phoneTail(text);
  if (tail) q.phoneTail = tail;
  if (/\p{L}/u.test(text) && text.length >= 2 && !UUID.test(text) && !HEX8.test(text))
    q.name = text;
  return Object.keys(q).length ? q : null;
}

/** A value for LIKE, its own % and _ taken as themselves. */
export function likeText(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}
