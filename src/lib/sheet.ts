/**
 * A table read from what a person pastes, or from the file they choose: a
 * delivery platform's statement, or the bank's. Pasted from a spreadsheet, its
 * cells are split by tabs; from a CSV file, by commas or semicolons, quoted as
 * spreadsheets quote them. A file is read in the browser, and nothing is sent:
 * an Excel workbook (.xlsx), its first sheet with something on it, its dates
 * as 2026-09-30; a CSV or text file, in UTF-8, UTF-16 or Windows Arabic; and
 * the web page or XML table some banks give as an ".xls". What a file holds is
 * shown as text, tab-separated, where the person sees it and can change it.
 * Pure, and the same in the browser and in the unit tests.
 */

export interface TableRow {
  /** The line of the text it starts on, from 1. */
  line: number;
  cells: string[];
}

type Sep = "\t" | ";" | ",";

/** Marks that set a text's direction: they show as nothing, and are no part of a cell. */
const BIDI = /[\u200E\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;

const clean = (cell: string) => cell.replace(BIDI, "").trim();

/**
 * The separator the first lines use: a tab (a spreadsheet's copy), a
 * semicolon, or a comma. Each line with one has its say, so a title above the
 * table, with none, does not decide it.
 */
function separatorOf(text: string): Sep {
  const votes: Record<Sep, number> = { "\t": 0, ";": 0, ",": 0 };
  let first: Sep | null = null;
  let seen = 0;
  for (const line of text.slice(0, 65536).split(/\r\n|\n|\r/)) {
    if (line.trim() === "") continue;
    if (++seen > 20) break;
    const sep: Sep | null = line.includes("\t")
      ? "\t"
      : line.includes(";")
        ? ";"
        : line.includes(",")
          ? ","
          : null;
    if (sep === null) continue;
    first ??= sep;
    votes[sep]++;
  }
  if (first === null) return ",";
  const most = Math.max(votes["\t"], votes[";"], votes[","]);
  return votes[first] === most
    ? first
    : (["\t", ";", ","] as Sep[]).find((s) => votes[s] === most)!;
}

/**
 * The rows of a text. A cell in quotes may hold the separator, a doubled
 * quote, or a line break (read as a space); a quote left open to the end is
 * read line by line instead, as it was typed.
 */
function tokenize(text: string, sep: Sep, across: boolean): { rows: TableRow[]; open: boolean } {
  const rows: TableRow[] = [];
  let cells: string[] = [];
  let cur = "";
  let quoted = false;
  let line = 1;
  let start = 1;
  const endRow = () => {
    cells.push(clean(cur));
    rows.push({ line: start, cells });
    cells = [];
    cur = "";
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    const newline = ch === "\n" || ch === "\r";
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i++;
        } else quoted = false;
      } else if (newline) {
        if (!across) {
          quoted = false;
          i--;
          continue;
        }
        if (ch === "\r" && text[i + 1] === "\n") i++;
        cur += " ";
        line++;
      } else cur += ch;
    } else if (ch === '"' && cur.trim() === "") {
      quoted = true;
      cur = "";
    } else if (ch === sep) {
      cells.push(clean(cur));
      cur = "";
    } else if (newline) {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      endRow();
      line++;
      start = line;
    } else cur += ch;
  }
  if (cur !== "" || cells.length > 0 || quoted) endRow();
  return { rows, open: quoted };
}

/** A pasted or read text's rows, blank ones too, each with the line it starts on. */
export function readTable(text: string): TableRow[] {
  const s = text.replace(/^\uFEFF/, "");
  const sep = separatorOf(s);
  const t = tokenize(s, sep, true);
  return t.open ? tokenize(s, sep, false).rows : t.rows;
}

export const isBlank = (row: TableRow) => row.cells.every((c) => c === "");

/** A cell that is a total's name: "Total", "المجموع". */
export const TOTAL_CELL =
  /^(total|totals|grand total|sum|subtotal|المجموع|الإجمالي|المجموع الكلي|کۆ|کۆی گشتی)$/i;
/** A cell that starts a total's row: "Total orders", "Total debit", "إجمالي المسحوبات". */
export const TOTAL_START =
  /^(?:grand\s+|sub\s*)?totals?\b|^(?:ال)?(?:مجموع|إجمالي|اجمالي)(?:\s|$)|^کۆی گشتی/i;
/** Words, not a number or a code: "Generated on 30/09/2026", "Page 1 of 2". */
export const PROSE = /\p{L}{3,}\s+\S/u;

/** A column's name as a statement prints it, made plain: "Commission (IQD)" is "commission". */
export function headerName(cell: string): string {
  return cell
    .replace(BIDI, "")
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/\b(iqd)\b/g, " ")
    .replace(/[#:*]/g, " ")
    .replace(/[\s_\-.]+/g, " ")
    .trim();
}

/**
 * The first column named by any of the names, the names in the order they
 * are preferred: "Description" before "Reference", whatever their order.
 */
export function columnNamed(names: readonly string[], wanted: readonly string[]): number | null {
  for (const w of wanted) {
    const i = names.indexOf(w);
    if (i >= 0) return i;
  }
  return null;
}

/**
 * Rows as tab-separated text, the way a spreadsheet copies them: a cell's
 * tabs and line breaks become spaces, and one starting with a quote is quoted,
 * so reading it back gives the same cells.
 */
export function toTsv(rows: readonly (readonly string[])[]): string {
  const lines = rows.map((row) => {
    const cells = row.map((c) => clean(c.replace(/[\t\r\n]+/g, " ")));
    while (cells.length > 0 && cells[cells.length - 1] === "") cells.pop();
    return cells.map((c) => (c.startsWith('"') ? `"${c.replace(/"/g, '""')}"` : c)).join("\t");
  });
  while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  while (lines.length > 0 && lines[0] === "") lines.shift();
  return lines.join("\n");
}

// --- A file's text ---------------------------------------------------------------

/**
 * A text file's words: UTF-8 (with its mark or without), UTF-16 (with its
 * mark, or plainly so), else Windows Arabic, as Excel saves a CSV on a
 * computer set to Arabic.
 */
export function decodeText(bytes: Uint8Array): string {
  const [a, b, c, d] = [bytes[0], bytes[1], bytes[2], bytes[3]];
  if (a === 0xff && b === 0xfe) return new TextDecoder("utf-16le").decode(bytes);
  if (a === 0xfe && b === 0xff) return new TextDecoder("utf-16be").decode(bytes);
  if (bytes.length >= 4 && a !== 0 && b === 0 && c !== 0 && d === 0)
    return new TextDecoder("utf-16le").decode(bytes);
  if (bytes.length >= 4 && a === 0 && b !== 0 && c === 0 && d !== 0)
    return new TextDecoder("utf-16be").decode(bytes);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1256").decode(bytes);
  }
}

// --- An Excel workbook (.xlsx) ----------------------------------------------------

/** Why a file cannot be read, as the person is told it. */
class Unreadable extends Error {}

export const FILE_MAX = 10 * 1024 * 1024;
/** What one part of a workbook may unpack to: a year of a bank's lines is far less. */
const PART_MAX = 60 * 1024 * 1024;
const MAX_ROWS = 20000;
const MAX_COLUMNS = 60;

const NOT_A_TABLE = "The file is not a table: choose the statement's Excel or CSV file.";
const CANNOT_UNPACK =
  "This browser cannot open Excel files: save the statement as CSV and choose that.";

const u16 = (b: Uint8Array, at: number) => (b[at] ?? 0) | ((b[at + 1] ?? 0) << 8);
const u32 = (b: Uint8Array, at: number) =>
  ((b[at] ?? 0) | ((b[at + 1] ?? 0) << 8) | ((b[at + 2] ?? 0) << 16) | ((b[at + 3] ?? 0) << 24)) >>>
  0;

interface ZipEntry {
  method: number;
  compressed: number;
  size: number;
  offset: number;
}

/** A zip's table of contents, from its end: each part's name, and where it is. */
function zipEntries(b: Uint8Array): Map<string, ZipEntry> {
  let end = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 22 - 0xffff); i--) {
    if (u32(b, i) === 0x06054b50) {
      end = i;
      break;
    }
  }
  if (end < 0) throw new Unreadable(NOT_A_TABLE);
  const count = u16(b, end + 10);
  let at = u32(b, end + 16);
  const names = new TextDecoder();
  const entries = new Map<string, ZipEntry>();
  for (let n = 0; n < count; n++) {
    if (at + 46 > b.length || u32(b, at) !== 0x02014b50) throw new Unreadable(NOT_A_TABLE);
    const nameLength = u16(b, at + 28);
    const name = names.decode(b.subarray(at + 46, at + 46 + nameLength)).replace(/\\/g, "/");
    entries.set(name, {
      method: u16(b, at + 10),
      compressed: u32(b, at + 20),
      size: u32(b, at + 24),
      offset: u32(b, at + 42),
    });
    at += 46 + nameLength + u16(b, at + 30) + u16(b, at + 32);
  }
  return entries;
}

async function inflate(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === "undefined") throw new Unreadable(CANNOT_UNPACK);
  let stream: ReadableStream<Uint8Array>;
  try {
    stream = new Blob([data.slice()]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  } catch {
    throw new Unreadable(CANNOT_UNPACK);
  }
  const reader = stream.getReader();
  const parts: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > PART_MAX) {
      await reader.cancel();
      throw new Unreadable(NOT_A_TABLE);
    }
    parts.push(value);
  }
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

async function unzip(b: Uint8Array, e: ZipEntry): Promise<Uint8Array> {
  if (u32(b, e.offset) !== 0x04034b50) throw new Unreadable(NOT_A_TABLE);
  const start = e.offset + 30 + u16(b, e.offset + 26) + u16(b, e.offset + 28);
  const data = b.subarray(start, start + e.compressed);
  if (e.method === 0) return data;
  if (e.method !== 8 || e.size > PART_MAX) throw new Unreadable(NOT_A_TABLE);
  return inflate(data);
}

const XML_ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function codePoint(n: number): string {
  return Number.isInteger(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : "";
}

/** Text as XML keeps it, made plain again: &amp; and &#1575; and Excel's _x000D_. */
function unescapeXml(s: string, named: Record<string, string> = XML_ENTITIES): string {
  return s
    .replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (whole, e: string) =>
      e[0] === "#"
        ? codePoint(
            e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10),
          )
        : (named[e.toLowerCase()] ?? whole),
    )
    .replace(/_x([0-9A-Fa-f]{4})_/g, (_, h: string) => codePoint(parseInt(h, 16)));
}

/**
 * An element, anywhere, with any prefix: its attributes, and its contents
 * when it is not empty. An attribute's value may hold a ">".
 */
const element = (name: string) =>
  new RegExp(
    `<(?:\\w+:)?${name}\\b((?:[^>"']|"[^"]*"|'[^']*')*?)(?:\\/>|>([\\s\\S]*?)<\\/(?:\\w+:)?${name}>)`,
    "g",
  );
const RELATIONSHIP = element("Relationship");
const SI = element("si");
const T = element("t");
const NUMFMT = element("numFmt");
const XF = element("xf");
const ROW = element("row");
const CELL = element("c");
const SHEET = element("sheet");
const ROW_2003 = element("Row");
const CELL_2003 = element("Cell");

/** A tag's attributes, by their full names and by their names without a prefix. */
function attrs(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of s.matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
    const value = unescapeXml(m[2] ?? m[3] ?? "");
    out[m[1]!] = value;
    const local = m[1]!.includes(":") ? m[1]!.slice(m[1]!.indexOf(":") + 1) : null;
    if (local && out[local] === undefined) out[local] = value;
  }
  return out;
}

/** A part's path, from the folder of the part pointing to it. */
function resolvePart(base: string, target: string): string {
  const parts = (target.startsWith("/") ? target.slice(1) : base + target).split("/");
  const out: string[] = [];
  for (const p of parts) {
    if (p === "..") out.pop();
    else if (p !== "." && p !== "") out.push(p);
  }
  return out.join("/");
}

function relationships(
  xml: string | null,
  base: string,
): { id: string; type: string; target: string }[] {
  if (!xml) return [];
  return [...xml.matchAll(RELATIONSHIP)]
    .map((m) => attrs(m[1]!))
    .filter((a) => a.TargetMode !== "External" && a.Target)
    .map((a) => ({ id: a.Id ?? "", type: a.Type ?? "", target: resolvePart(base, a.Target!) }));
}

/** The words of a shared or inline string: its runs, without the pronunciation guides. */
function runText(xml: string): string {
  const body = xml.replace(/<(?:\w+:)?rPh\b[\s\S]*?<\/(?:\w+:)?rPh>/g, "");
  let s = "";
  for (const t of body.matchAll(T)) s += t[2] ?? "";
  return unescapeXml(s);
}

function sharedStrings(xml: string | null): string[] {
  if (!xml) return [];
  return [...xml.matchAll(SI)].map((m) => runText(m[2] ?? ""));
}

type Shown = "date" | "datetime" | "time" | null;

/** What a number format shows: a date, a date and time, a time of day, or a number. */
function shownAs(id: number, custom: Map<number, string>): Shown {
  const code = custom.get(id);
  if (code === undefined) {
    if ((id >= 14 && id <= 17) || (id >= 27 && id <= 36) || (id >= 50 && id <= 58)) return "date";
    if (id === 22) return "datetime";
    if ((id >= 18 && id <= 21) || (id >= 45 && id <= 47)) return "time";
    return null;
  }
  const bare = code
    .replace(/"[^"]*"/g, "")
    .replace(/\\./g, "")
    .replace(/\[[^\]]*\]/g, "")
    .split(";")[0]!;
  const date = /[dy]/i.test(bare);
  const time = /[hs]/i.test(bare);
  return date ? (time ? "datetime" : "date") : time ? "time" : null;
}

/** Each cell style of the workbook, by its number: what its number format shows. */
function cellStyles(xml: string | null): Shown[] {
  if (!xml) return [];
  const custom = new Map<number, string>();
  for (const m of xml.matchAll(NUMFMT)) {
    const a = attrs(m[1]!);
    custom.set(Number(a.numFmtId), a.formatCode ?? "");
  }
  const xfs = /<(?:\w+:)?cellXfs\b[^>]*>([\s\S]*?)<\/(?:\w+:)?cellXfs>/.exec(xml)?.[1] ?? "";
  return [...xfs.matchAll(XF)].map((m) => shownAs(Number(attrs(m[1]!).numFmtId ?? 0), custom));
}

/** A spreadsheet's day number as the date, or the date and time, it shows. */
function serialDate(n: number, shown: Exclude<Shown, null>, date1904: boolean): string | null {
  if (!(n >= 0 && n < 2958466)) return null;
  const seconds = Math.round((n + (date1904 ? 1462 : 0) - 25569) * 86400);
  const iso = new Date(seconds * 1000).toISOString();
  const day = iso.slice(0, 10);
  const time = iso.slice(11, 16);
  if (shown === "time") return time;
  return shown === "datetime" && time !== "00:00" ? `${day} ${time}` : day;
}

/** A number as Excel keeps it; one it worked out to 17 digits (2549.9999999999995), as it shows. */
function numberText(v: string, n: number): string {
  return /^-?\d+(\.\d{1,6})?$/.test(v) ? v : String(Number(n.toFixed(6)));
}

/**
 * A date and time with its zone, as some exports write them
 * ("2026-09-13T21:00:00Z", "2026-09-14 08:00:00+03:00", "… +0300", "… +03"):
 * a moment, whose day is the one it was where the café is. Its parts: the
 * year, month and day, the hours and minutes, the seconds, their fraction,
 * and the zone.
 */
export const ZONED_TIME =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}:\d{2})(?::(\d{2})(?:\.(\d+))?)?\s*(Z|[+-]\d{2}(?::?\d{2})?)$/i;

/**
 * An ISO date and time, as the date, or the date and time when it has one;
 * with its zone, kept whole, to be read in the café's time.
 */
function isoText(v: string): string {
  const s = v.trim();
  if (ZONED_TIME.test(s)) return s;
  const m = /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}))?/.exec(s);
  if (!m) return s;
  return m[2] && m[2] !== "00:00" ? `${m[1]} ${m[2]}` : m[1]!;
}

function columnIndex(ref: string): number {
  const letters = /^[A-Z]+/i.exec(ref)?.[0]?.toUpperCase() ?? "";
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function cellText(
  a: Record<string, string>,
  inner: string,
  shared: string[],
  styles: Shown[],
  date1904: boolean,
): string {
  const v = /<(?:\w+:)?v\b[^>]*>([\s\S]*?)<\/(?:\w+:)?v>/.exec(inner)?.[1];
  switch (a.t) {
    case "s":
      return shared[Number(v)] ?? "";
    case "inlineStr": {
      const is = /<(?:\w+:)?is\b[^>]*>([\s\S]*?)<\/(?:\w+:)?is>/.exec(inner)?.[1];
      return is === undefined ? "" : runText(is);
    }
    case "str":
    case "e":
      return v === undefined ? "" : unescapeXml(v);
    case "b":
      return v === "1" ? "TRUE" : v === "0" ? "FALSE" : "";
    case "d":
      return v === undefined ? "" : isoText(unescapeXml(v));
    default: {
      if (v === undefined || v.trim() === "") return "";
      const n = Number(v);
      if (!Number.isFinite(n)) return unescapeXml(v);
      const shown = styles[Number(a.s ?? 0)] ?? null;
      return (shown && serialDate(n, shown, date1904)) ?? numberText(v.trim(), n);
    }
  }
}

function sheetRows(xml: string, shared: string[], styles: Shown[], date1904: boolean): string[][] {
  const data =
    /<(?:\w+:)?sheetData\b[^>]*?(?:\/>|>([\s\S]*?)<\/(?:\w+:)?sheetData>)/.exec(xml)?.[1] ?? "";
  const rows: string[][] = [];
  let next = 0;
  for (const m of data.matchAll(ROW)) {
    const a = attrs(m[1]!);
    const r = a.r ? Number(a.r) - 1 : next;
    if (!(r >= 0) || r >= MAX_ROWS) break;
    next = r + 1;
    const cells: string[] = [];
    let col = 0;
    for (const c of (m[2] ?? "").matchAll(CELL)) {
      const ca = attrs(c[1]!);
      const at = ca.r ? columnIndex(ca.r) : col;
      col = at + 1;
      if (at < 0 || at >= MAX_COLUMNS) continue;
      while (cells.length < at) cells.push("");
      cells[at] = cellText(ca, c[2] ?? "", shared, styles, date1904);
    }
    while (rows.length < r) rows.push([]);
    rows[r] = cells;
  }
  return rows;
}

/** An Excel workbook's rows: its first sheet with something on it. */
export async function readXlsx(bytes: Uint8Array): Promise<string[][]> {
  const zip = zipEntries(bytes);
  const decoder = new TextDecoder();
  const part = async (name: string): Promise<string | null> => {
    const e = zip.get(name);
    return e ? decoder.decode(await unzip(bytes, e)) : null;
  };
  const main =
    relationships(await part("_rels/.rels"), "").find((r) => r.type.endsWith("/officeDocument"))
      ?.target ?? "xl/workbook.xml";
  const book = await part(main);
  if (book === null) throw new Unreadable(NOT_A_TABLE);
  const dir = main.includes("/") ? main.slice(0, main.lastIndexOf("/") + 1) : "";
  const rels = relationships(await part(`${dir}_rels/${main.slice(dir.length)}.rels`), dir);
  const target = (type: string, fallback: string) =>
    rels.find((r) => r.type.endsWith(type))?.target ?? `${dir}${fallback}`;
  const date1904 = /<(?:\w+:)?workbookPr\b[^>]*\bdate1904\s*=\s*["'](?:1|true)["']/i.test(book);
  const shared = sharedStrings(await part(target("/sharedStrings", "sharedStrings.xml")));
  const styles = cellStyles(await part(target("/styles", "styles.xml")));
  const sheets = [...book.matchAll(SHEET)]
    .map((m) => attrs(m[1]!))
    .map((a) => rels.find((r) => r.id === (a["r:id"] ?? a.id))?.target)
    .filter((t): t is string => !!t);
  for (const path of sheets) {
    const xml = await part(path);
    if (xml === null) continue;
    const rows = sheetRows(xml, shared, styles, date1904);
    if (rows.some((r) => r.some((c) => c.trim() !== ""))) return rows;
  }
  return [];
}

// --- A web page's table, and Excel 2003's XML ------------------------------------------

const HTML_ENTITIES: Record<string, string> = { ...XML_ENTITIES, nbsp: " " };

const htmlText = (s: string) =>
  unescapeXml(s.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]*>/g, ""), HTML_ENTITIES)
    .replace(/\s+/g, " ")
    .trim();

/** The rows of a web page's tables: what some banks save as an ".xls". */
function htmlRows(html: string): string[][] {
  const body = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, "");
  const rows: string[][] = [];
  for (const tr of body.split(/<tr\b[^>]*>/i).slice(1)) {
    const chunk = tr.split(/<\/tr\s*>|<\/table\s*>/i)[0]!;
    const cells: string[] = [];
    const re = /<t([dh])\b([^>]*)>([\s\S]*?)(?=<t[dh]\b|<\/t[dh]\s*>|$)/gi;
    for (const m of chunk.matchAll(re)) {
      cells.push(htmlText(m[3] ?? ""));
      const span = Number(attrs(m[2] ?? "").colspan ?? 1);
      for (let i = 1; i < Math.min(span, MAX_COLUMNS); i++) cells.push("");
    }
    rows.push(cells);
    if (rows.length >= MAX_ROWS) break;
  }
  return rows;
}

/** The rows of Excel 2003's XML ("XML Spreadsheet"): its first sheet with something on it. */
function xml2003Rows(xml: string): string[][] {
  for (const sheet of xml.matchAll(
    /<(?:\w+:)?Worksheet\b[^>]*>([\s\S]*?)<\/(?:\w+:)?Worksheet>/g,
  )) {
    const rows: string[][] = [];
    let r = 0;
    for (const row of sheet[1]!.matchAll(ROW_2003)) {
      const index = Number(attrs(row[1]!).Index);
      r = index > 0 ? index - 1 : r;
      if (r >= MAX_ROWS) break;
      const cells: string[] = [];
      let c = 0;
      for (const cell of (row[2] ?? "").matchAll(CELL_2003)) {
        const at = Number(attrs(cell[1]!).Index);
        c = at > 0 ? at - 1 : c;
        if (c >= MAX_COLUMNS) break;
        const data = /<(?:\w+:)?Data\b([^>]*)>([\s\S]*?)<\/(?:\w+:)?Data>/.exec(cell[2] ?? "");
        const type = data ? attrs(data[1]!).Type : undefined;
        const text = data ? htmlText(data[2]!) : "";
        while (cells.length < c) cells.push("");
        cells[c] = type === "DateTime" ? isoText(text) : text;
        c++;
      }
      while (rows.length < r) rows.push([]);
      rows[r] = cells;
      r++;
    }
    if (rows.some((x) => x.some((y) => y !== ""))) return rows;
  }
  return [];
}

// --- A statement's file ------------------------------------------------------------

export type FileRead = { ok: true; text: string } | { ok: false; error: string };

function asText(rows: string[][]): FileRead {
  const text = toTsv(rows);
  return text.trim() === ""
    ? { ok: false, error: "There is nothing in the file to read." }
    : { ok: true, text };
}

/**
 * A statement's file, as the text of its table, tab-separated; or why it
 * cannot be read, in words the person is told.
 */
export async function readStatementFile(bytes: Uint8Array): Promise<FileRead> {
  if (bytes.length === 0) return { ok: false, error: "There is nothing in the file to read." };
  if (bytes.length > FILE_MAX)
    return { ok: false, error: "The file is over 10 MB: a statement's own file is smaller." };
  const head = String.fromCharCode(...bytes.subarray(0, 5));
  try {
    if (head.startsWith("PK\u0003\u0004")) return asText(await readXlsx(bytes));
    if (bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0)
      return {
        ok: false,
        error:
          "An Excel 97–2003 file (.xls) is not read: open it in Excel, save it as .xlsx or CSV, and choose that.",
      };
    if (head === "%PDF-")
      return {
        ok: false,
        error: "A PDF is not read: download the statement as Excel or CSV, and choose that.",
      };
    const text = decodeText(bytes);
    if (text.slice(0, 4000).includes("\u0000")) return { ok: false, error: NOT_A_TABLE };
    const start = text
      .replace(/^\uFEFF/, "")
      .trimStart()
      .slice(0, 400)
      .toLowerCase();
    if (start.startsWith("<")) {
      if (/urn:schemas-microsoft-com:office:spreadsheet/.test(text))
        return asText(xml2003Rows(text));
      if (/<table\b/i.test(text)) return asText(htmlRows(text));
      return { ok: false, error: NOT_A_TABLE };
    }
    return asText(readTable(text).map((r) => r.cells));
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof Unreadable
          ? e.message
          : "The file could not be read: save it again as .xlsx or CSV, and choose that.",
    };
  }
}
