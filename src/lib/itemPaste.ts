/**
 * Paste stock items in (round seven): the rows of a list copied from Excel or
 * Google Sheets, or typed, read into the stock items they stand for, each one
 * checked before anything is added, in the terms the one-item form uses (0027,
 * release H): its unit one of g, kg, ml, L or each, its numbers numbers, and
 * its name neither an item's already in use nor another row's. Pure: the
 * screen and the tests read through here.
 *
 * The columns, in this order: name, unit, reorder at, on the shelf, cost each,
 * Arabic name, Kurdish name. Only the name and the unit are needed. The
 * numbers are in the unit the row gives: 24 on the shelf of milk in L is 24
 * litres, at its cost a litre; the item keeps its stock in ml, and is bought
 * in L as well.
 */
import { lookAlikes, type LookAlike, type NamedItem } from "@/lib/names";
import { normaliseNumber } from "@/lib/validation";

export type Dimension = "count" | "mass" | "volume";

/** A unit a row may give: the item's base unit, and what one of it holds in the base. */
export interface PasteUnit {
  code: "g" | "kg" | "ml" | "L" | "each";
  base: "g" | "ml" | "each";
  dimension: Dimension;
  factor: number;
}

export const PASTE_UNITS: readonly PasteUnit[] = [
  { code: "g", base: "g", dimension: "mass", factor: 1 },
  { code: "kg", base: "g", dimension: "mass", factor: 1000 },
  { code: "ml", base: "ml", dimension: "volume", factor: 1 },
  { code: "L", base: "ml", dimension: "volume", factor: 1000 },
  { code: "each", base: "each", dimension: "count", factor: 1 },
];

/** The words a unit is written in, in English, Arabic and Kurdish (folded, see fold). */
const UNIT_WORDS: Record<PasteUnit["code"], readonly string[]> = {
  g: [
    "g",
    "gr",
    "grs",
    "gm",
    "gms",
    "gram",
    "grams",
    "gramme",
    "grammes",
    "غ",
    "غم",
    "غرام",
    "جم",
    "جرام",
    "گرام",
    "گم",
  ],
  kg: [
    "kg",
    "kgs",
    "kilo",
    "kilos",
    "kilogram",
    "kilograms",
    "kilogramme",
    "كغ",
    "كغم",
    "كجم",
    "كيلو",
    "كيلوغرام",
    "كيلوجرام",
    "كيلوگرام",
    "کیلۆ",
    "کیلۆگرام",
    "کگ",
  ],
  ml: [
    "ml",
    "mls",
    "millilitre",
    "millilitres",
    "milliliter",
    "milliliters",
    "مل",
    "ملل",
    "مليلتر",
    "ميليلتر",
    "مليليتر",
  ],
  L: [
    "l",
    "lt",
    "lts",
    "ltr",
    "ltrs",
    "litre",
    "litres",
    "liter",
    "liters",
    "لتر",
    "ليتر",
    "ليتهر",
  ],
  each: ["each", "ea", "pc", "pcs", "piece", "pieces", "قطعه", "حبه", "عدد", "دانه", "پارچه"],
};

/**
 * A word as compared: in small letters, without accents or dots, and with the
 * Arabic and Kurdish ways of writing the same letter made one (ک and ك, ی and
 * ي, ە and ه and ة, أ إ آ and ا).
 */
export function fold(s: string): string {
  return s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\p{M}/gu, "")
    .replace(/ـ/g, "")
    .replace(/[کڪ]/g, "ك")
    .replace(/[یى]/g, "ي")
    .replace(/[ەۀة]/g, "ه")
    .replace(/[أإآ]/g, "ا")
    .replace(/[.\s]/g, "");
}

const UNIT_BY_WORD = new Map<string, PasteUnit>(
  PASTE_UNITS.flatMap((u) => UNIT_WORDS[u.code].map((w) => [fold(w), u] as const)),
);

/** The unit a word names, if it names one. */
export function unitOf(word: string): PasteUnit | null {
  return UNIT_BY_WORD.get(fold(word)) ?? null;
}

/** A first row that names its columns rather than an item. */
const HEADER_WORDS = new Set(
  [
    "name",
    "item",
    "items",
    "unit",
    "units",
    "uom",
    "الاسم",
    "اسم",
    "الماده",
    "الوحده",
    "وحده",
    "ناو",
    "كالا",
    "يهكه",
  ].map(fold),
);

/** A number as typed, or null when blank; NaN when it is not one. */
function numberOf(cell: string | undefined): number | null {
  const s = (cell ?? "").trim();
  if (s === "") return null;
  // As the forms read a number: 1,250 and ١٢٥٠ are 1250; 24L, 1e3 and 0x10 are not numbers.
  const v = normaliseNumber(s);
  return /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : Number.NaN;
}

/** A cell with something in it that is a number. */
const isNumber = (cell: string) => {
  const n = numberOf(cell);
  return n !== null && !Number.isNaN(n);
};

/**
 * One line's cells: split at its tabs (Excel and Google Sheets copy so), or
 * its semicolons, or its bars; a line typed with none of those is read from
 * its end — the numbers last, the unit before them, the name the rest
 * ("Pistachio paste kg 2 5 38,000"), its words' trailing commas set aside.
 */
export function cellsOf(line: string): string[] {
  for (const sep of ["\t", ";", "|"]) {
    if (line.includes(sep)) return line.split(sep).map((c) => c.trim());
  }
  const words = line
    .trim()
    .split(/\s+/)
    .map((w) => w.replace(/,+$/, ""))
    .filter((w) => w !== "");
  let end = words.length;
  const numbers: string[] = [];
  while (end > 0 && numbers.length < 3 && isNumber(words[end - 1]!)) {
    numbers.unshift(words[end - 1]!);
    end--;
  }
  let unit = "";
  if (end > 1 && unitOf(words[end - 1]!)) {
    unit = words[end - 1]!;
    end--;
  }
  return [words.slice(0, end).join(" "), unit, ...numbers];
}

export type ProblemKey =
  | "Give it a name"
  | "There is already an item called “{name}”."
  | "“{name}” is in the list twice (line {line})."
  | "Give its unit: g, kg, ml, L or each"
  | "“{unit}” is not a unit here: use g, kg, ml, L or each"
  | "“{value}” is not a number"
  | "“{value}” is below zero"
  | "Give what one {unit} cost";

export interface Problem {
  key: ProblemKey;
  vars?: Record<string, string | number>;
}

export interface PastedRow {
  /** Its line in what was pasted, from 1. */
  line: number;
  /** The line as pasted, to keep in the box while it is not added. */
  text: string;
  name: string;
  nameAr: string;
  nameCkb: string;
  /** The unit as typed, and the unit it is. */
  unitTyped: string;
  unit: PasteUnit | null;
  /** In the unit given; null when left blank. */
  reorder: number | null;
  shelf: number | null;
  cost: number | null;
  /** What keeps it from being added. */
  problems: Problem[];
  /** Items in use, or rows above it, whose names look like its: added only once the person says it is another. */
  similar: LookAlike[];
}

/**
 * The rows of what was pasted, each checked. A first row naming its columns
 * (Name, Unit…) is passed over, and so are blank lines.
 */
export function readPaste(text: string, items: readonly NamedItem[]): PastedRow[] {
  const lines = text.split(/\r?\n/);
  const rows: PastedRow[] = [];
  let first = true;
  lines.forEach((raw, i) => {
    if (raw.trim() === "") return;
    const cells = cellsOf(raw);
    if (first) {
      first = false;
      if (HEADER_WORDS.has(fold(cells[0] ?? "")) || HEADER_WORDS.has(fold(cells[1] ?? ""))) return;
    }
    const [name = "", unitTyped = "", reorderCell, shelfCell, costCell, nameAr = "", nameCkb = ""] =
      cells;
    const problems: Problem[] = [];
    const unit = unitTyped.trim() === "" ? null : unitOf(unitTyped);
    if (name.trim() === "") problems.push({ key: "Give it a name" });
    if (unitTyped.trim() === "") problems.push({ key: "Give its unit: g, kg, ml, L or each" });
    else if (!unit)
      problems.push({
        key: "“{unit}” is not a unit here: use g, kg, ml, L or each",
        vars: { unit: unitTyped.trim() },
      });
    const read = (cell: string | undefined) => {
      const n = numberOf(cell);
      if (n === null) return null;
      if (Number.isNaN(n)) {
        problems.push({ key: "“{value}” is not a number", vars: { value: (cell ?? "").trim() } });
        return null;
      }
      if (n < 0) {
        problems.push({ key: "“{value}” is below zero", vars: { value: (cell ?? "").trim() } });
        return null;
      }
      return n;
    };
    const reorder = read(reorderCell);
    const shelf = read(shelfCell);
    const cost = read(costCell);
    if (
      shelf !== null &&
      shelf > 0 &&
      cost === null &&
      !problems.some((p) => p.vars?.value === (costCell ?? "").trim())
    )
      problems.push({
        key: "Give what one {unit} cost",
        vars: { unit: unit?.code ?? unitTyped.trim() },
      });
    rows.push({
      line: i + 1,
      text: raw,
      name: name.trim(),
      nameAr: nameAr.trim(),
      nameCkb: nameCkb.trim(),
      unitTyped: unitTyped.trim(),
      unit,
      reorder,
      shelf,
      cost,
      problems,
      similar: [],
    });
  });

  // Each name against the items in use, and against the rows above it.
  rows.forEach((row, i) => {
    if (row.name === "") return;
    const named = { name: row.name, nameAr: row.nameAr, nameCkb: row.nameCkb };
    const there = lookAlikes(named, items as NamedItem[]);
    const same = there.find((s) => s.same);
    if (same) {
      row.problems.push({
        key: "There is already an item called “{name}”.",
        vars: { name: same.name },
      });
      return;
    }
    const above = rows.slice(0, i).filter((r) => r.name !== "");
    const twice = lookAlikes(
      named,
      above.map((r) => ({
        id: `line-${r.line}`,
        name: r.name,
        nameAr: r.nameAr || null,
        nameCkb: r.nameCkb || null,
      })),
    );
    const again = twice.find((s) => s.same);
    if (again) {
      row.problems.push({
        key: "“{name}” is in the list twice (line {line}).",
        vars: { name: row.name, line: Number(again.id.slice(5)) },
      });
      return;
    }
    row.similar = [...there, ...twice];
  });
  return rows;
}

/** Up to six decimals, without float noise: 1.15 × 1000 is 1150, not 1149.9999999999998. */
const exact = (n: number) => Math.round(n * 1e6) / 1e6;

export type ItemType = "ingredient" | "packaging" | "consumable" | "finished_good" | "resale";

/**
 * What the one-item form would send for a row (createItemAction's input): its
 * levels and stock in the base unit, its cost a base unit, and kg or L as a
 * unit it is bought in. Stock on the shelf is the owner's to record (0027),
 * with where it came from; for anyone else it is left out.
 */
export function itemInputOf(
  row: PastedRow,
  o: { itemType: ItemType; isOwner: boolean; reason: string; acceptSimilar: boolean },
) {
  const u = row.unit ?? PASTE_UNITS[4]!;
  const opening = o.isOwner && row.shelf !== null && row.shelf > 0 && row.cost !== null;
  return {
    name: row.name,
    nameAr: row.nameAr,
    nameCkb: row.nameCkb,
    itemType: o.itemType,
    baseUnit: u.base,
    dimension: u.dimension,
    minLevel: row.reorder !== null ? String(exact(row.reorder * u.factor)) : null,
    openingQty: opening ? String(exact(row.shelf! * u.factor)) : null,
    openingUnitCost: opening ? String(exact(row.cost! / u.factor)) : null,
    openingReason: opening ? o.reason.trim() || null : null,
    returnable: false,
    pack: u.factor !== 1 ? { label: u.code, holds: String(u.factor) } : null,
    acceptSimilar: o.acceptSimilar,
  };
}

/** A row ready to add: nothing wrong with it, and any look-alike answered. */
export function isReady(row: PastedRow, accepted: boolean): boolean {
  return row.problems.length === 0 && (row.similar.length === 0 || accepted);
}

/** Every phrase the paste may show for a row's problem: each is in the books. */
export const PASTE_PROBLEMS: readonly ProblemKey[] = [
  "Give it a name",
  "There is already an item called “{name}”.",
  "“{name}” is in the list twice (line {line}).",
  "Give its unit: g, kg, ml, L or each",
  "“{unit}” is not a unit here: use g, kg, ml, L or each",
  "“{value}” is not a number",
  "“{value}” is below zero",
  "Give what one {unit} cost",
];
