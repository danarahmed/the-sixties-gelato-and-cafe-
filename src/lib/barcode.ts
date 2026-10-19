/**
 * Barcodes (round twenty, 0078): what a scanner types at the till, read as a
 * size of the menu; a scale's label for a size sold by weight read as the
 * size and its weight; and a barcode drawn for the café's own labels.
 */

/** The check digit of an EAN-13's first twelve digits. */
export function ean13Check(twelve: string): number {
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(twelve[i]) * (i % 2 === 0 ? 1 : 3);
  return (10 - (sum % 10)) % 10;
}

/** Whether a code is an EAN-13 whose check digit is right. */
export function isEan13(code: string): boolean {
  return /^\d{13}$/.test(code) && ean13Check(code.slice(0, 12)) === Number(code[12]);
}

/** A new EAN-13 for the café's own labels: "29", ten digits from `n`, and its check digit. */
export function internalEan13(n: number): string {
  const twelve = `29${String(Math.abs(Math.trunc(n)) % 1e10).padStart(10, "0")}`;
  return `${twelve}${ean13Check(twelve)}`;
}

export interface Scannable {
  variantId: string;
  barcode: string | null;
  soldByWeight?: boolean;
}

export type Scan = { variantId: string; kg: number | null } | null;

/**
 * What a scan names: the size with that barcode; or, for a scale's label
 * (thirteen digits from "20" to "29": the prefix, a five-digit code, the
 * weight in grams, a check digit), the size sold by weight with that code and
 * the weight. Nothing when no size has it.
 */
export function readScan(raw: string, items: readonly Scannable[]): Scan {
  const code = raw.replace(/\s+/g, "");
  if (code.length < 4) return null;
  const exact = items.find((i) => i.barcode !== null && i.barcode === code);
  if (exact) return { variantId: exact.variantId, kg: null };
  const m = /^2(\d)(\d{5})(\d{5})(\d)$/.exec(code);
  if (m && isEan13(code)) {
    const plu = m[2]!;
    const grams = Number(m[3]);
    const weighed = items.find(
      (i) =>
        i.soldByWeight &&
        i.barcode !== null &&
        (i.barcode === plu || i.barcode === plu.replace(/^0+/, "")),
    );
    if (weighed && grams > 0) return { variantId: weighed.variantId, kg: grams / 1000 };
  }
  return null;
}

// ------------------------------------------------------------------ drawing
// Code 128 (set B, and set C for an even run of digits): each symbol is six
// bars and spaces, their widths in modules.
const PATTERNS = [
  "212222",
  "222122",
  "222221",
  "121223",
  "121322",
  "131222",
  "122213",
  "122312",
  "132212",
  "221213",
  "221312",
  "231212",
  "112232",
  "122132",
  "122231",
  "113222",
  "123122",
  "123221",
  "223211",
  "221132",
  "221231",
  "213212",
  "223112",
  "312131",
  "311222",
  "321122",
  "321221",
  "312212",
  "322112",
  "322211",
  "212123",
  "212321",
  "232121",
  "111323",
  "131123",
  "131321",
  "112313",
  "132113",
  "132311",
  "211313",
  "231113",
  "231311",
  "112133",
  "112331",
  "132131",
  "113123",
  "113321",
  "133121",
  "313121",
  "211331",
  "231131",
  "213113",
  "213311",
  "213131",
  "311123",
  "311321",
  "331121",
  "312113",
  "312311",
  "332111",
  "314111",
  "221411",
  "431111",
  "111224",
  "111422",
  "121124",
  "121421",
  "141122",
  "141221",
  "112214",
  "112412",
  "122114",
  "122411",
  "142112",
  "142211",
  "241211",
  "221114",
  "413111",
  "241112",
  "134111",
  "111242",
  "121142",
  "121241",
  "114212",
  "124112",
  "124211",
  "411212",
  "421112",
  "421211",
  "212141",
  "214121",
  "412121",
  "111143",
  "111341",
  "131141",
  "114113",
  "114311",
  "411113",
  "411311",
  "113141",
  "114131",
  "311141",
  "411131",
  "211412",
  "211214",
  "211232",
  "2331112",
];
const START_B = 104;
const START_C = 105;
const STOP = 106;

/** The symbols of a code in Code 128: set C when it is all digits, two to a symbol, set B otherwise. */
export function code128Symbols(text: string): number[] {
  const digits = /^\d+$/.test(text) && text.length % 2 === 0;
  const symbols: number[] = [];
  if (digits) {
    symbols.push(START_C);
    for (let i = 0; i < text.length; i += 2) symbols.push(Number(text.slice(i, i + 2)));
  } else {
    symbols.push(START_B);
    for (const ch of text) {
      const c = ch.charCodeAt(0);
      if (c < 32 || c > 126) throw new Error("Code 128 set B takes printable ASCII only");
      symbols.push(c - 32);
    }
  }
  const check = symbols.reduce((s, v, i) => s + v * (i === 0 ? 1 : i), 0) % 103;
  symbols.push(check, STOP);
  return symbols;
}

/** The bars of a code: [x, width] in modules, with the quiet zone before; and the width in all. */
export function code128Bars(text: string): { bars: [number, number][]; width: number } {
  const quiet = 10;
  let x = quiet;
  const bars: [number, number][] = [];
  for (const s of code128Symbols(text)) {
    const p = PATTERNS[s]!;
    for (let i = 0; i < p.length; i++) {
      const w = Number(p[i]);
      if (i % 2 === 0) bars.push([x, w]);
      x += w;
    }
  }
  return { bars, width: x + quiet };
}
