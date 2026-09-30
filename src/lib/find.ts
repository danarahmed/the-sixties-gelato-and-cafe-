/**
 * Finding things (the September audit's P2-20, "hard to find things"): what
 * was typed in a search box, read as each way a thing is named. Pure: the
 * screens and the tests both read through here.
 *
 * A sale, on Orders:
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
import { fold } from "@/components/pos/model";

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
export const SEARCH_MAX = 60;

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

/**
 * What was typed in a search box, as it is looked for: its digits 0–9, its
 * spaces one, a leading # gone. Null when empty, or longer than a search holds.
 */
export function searchText(input: string | null | undefined): string | null {
  const text = latinDigits(String(input ?? ""))
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^#+\s*/, "");
  return text && text.length <= SEARCH_MAX ? text : null;
}

/** What was typed on Orders, read as every way it can name a sale; null when nothing is. */
export function readSaleQuery(input: string | null | undefined): SaleQuery | null {
  const text = searchText(input);
  if (!text) return null;
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

/** A journal, on Journals: by its number, or by words in it. */
export interface JournalQuery {
  /** Its number. */
  number?: number;
  /** Words in its description, its reference or a line's note. */
  words?: string;
}

/** What was typed on Journals; null when nothing is. */
export function readJournalQuery(input: string | null | undefined): JournalQuery | null {
  const text = searchText(input);
  if (!text) return null;
  const q: JournalQuery = {};
  if (/^\d{1,9}$/.test(text)) q.number = Number(text);
  if (text.length >= 2) q.words = text;
  return Object.keys(q).length ? q : null;
}

/**
 * Whether a product is one a search names, on Products & Recipes: part of its
 * name or a size's, in any of its languages, forgiving case, accents and
 * Arabic and Kurdish letter forms, as the till's search does.
 */
export function namesMatch(names: readonly (string | null | undefined)[], typed: string): boolean {
  const q = fold(typed);
  return q.length > 0 && names.some((n) => !!n && fold(n).includes(q));
}
