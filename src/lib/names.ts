/**
 * Names that look alike (release H). Whoever does the purchasing can add an
 * item from the receipt itself, and a busy day brings many bills: "Botled
 * water" typed beside "Bottled water" would make a second item for the same
 * thing, its stock and costs split in two. Before a new item is added, the
 * screen shows the items already there whose names look like it.
 *
 * Two kinds of match:
 *  - the same name: whatever its capitals, spaces or punctuation, as the
 *    database's name_key (0027) sees it. The database refuses it anyway.
 *  - a look-alike: the same once Arabic and Kurdish letter forms are folded
 *    together (ي ی, ك ک, ه ە …); the same words in another order; or a slip of
 *    the keyboard — a letter or two missing, extra, swapped or wrong, fewer
 *    the shorter the name. Names whose numbers differ ("Cup 8oz", "Cup 12oz")
 *    are different items, and so is a word with another first letter in a
 *    short name ("Ice", "Rice").
 */

/** What a new item not added because of its look-alikes is told (the list follows it). */
export const LOOKS_LIKE = "It looks like an item already on the list";

export interface NamedItem {
  id: string;
  name: string;
  nameAr?: string | null;
  nameCkb?: string | null;
}

export interface NewNames {
  name: string;
  nameAr?: string | null;
  nameCkb?: string | null;
}

export interface LookAlike {
  id: string;
  name: string;
  /** The same name as the database sees it: it would be refused. */
  same: boolean;
}

/** ASCII punctuation, as PostgreSQL's [[:punct:]] has it, with Unicode punctuation. */
const PUNCT = /[\s\p{P}$+<=>^`|~]+/gu;

/** The database's name_key (0027): lower case, without spaces or punctuation. */
export function nameKey(s: string): string {
  return s.toLowerCase().replace(PUNCT, "");
}

/** Letter forms one hand writes for another, folded together; digits made ASCII. */
const FOLD: Record<string, string> = {
  أ: "ا",
  إ: "ا",
  آ: "ا",
  ٱ: "ا",
  ى: "ي",
  ی: "ي",
  ئ: "ي",
  ێ: "ي",
  ک: "ك",
  ة: "ه",
  ە: "ه",
  ھ: "ه",
  ۆ: "و",
  ؤ: "و",
  ڕ: "ر",
  ڵ: "ل",
  ڤ: "ف",
};

function fold(s: string): string {
  return (
    s
      .normalize("NFKD")
      .toLowerCase()
      // Accents, Arabic vowel marks, the tatweel and invisible joiners.
      .replace(/[\p{M}ـ‌‍]/gu, "")
      .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
      .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
      .replace(/./gu, (c) => FOLD[c] ?? c)
  );
}

/** The words of a name, folded. */
function words(s: string): string[] {
  return fold(s)
    .split(PUNCT)
    .filter((w) => w !== "");
}

/** How many slips (a letter missing, extra, wrong, or two swapped) turn a into b. */
export function slips(a: string, b: string): number {
  const x = Array.from(a);
  const y = Array.from(b);
  const d: number[][] = Array.from({ length: x.length + 1 }, (_, i) =>
    Array.from({ length: y.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= x.length; i++) {
    for (let j = 1; j <= y.length; j++) {
      const cost = x[i - 1] === y[j - 1] ? 0 : 1;
      d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && x[i - 1] === y[j - 2] && x[i - 2] === y[j - 1]) {
        d[i]![j] = Math.min(d[i]![j]!, d[i - 2]![j - 2]! + 1);
      }
    }
  }
  return d[x.length]![y.length]!;
}

/** Slips allowed in a word or name of this many letters. */
function allowed(letters: number): number {
  if (letters <= 3) return 0;
  if (letters <= 6) return 1;
  if (letters <= 11) return 2;
  return 3;
}

const digits = (s: string) => (s.match(/\d+/g) ?? []).join(" ");

/**
 * How far apart two names look: 0 is the same once folded; a small number is
 * a look-alike; null is a different name.
 */
export function lookAlike(a: string, b: string): number | null {
  const wa = words(a);
  const wb = words(b);
  const ka = wa.join("");
  const kb = wb.join("");
  if (ka === "" || kb === "") return null;
  if (ka === kb) return 0;
  // The same words, in another order.
  if ([...wa].sort().join(" ") === [...wb].sort().join(" ")) return 0.5;
  // Different numbers are different items: a cup of 8 oz is not one of 12.
  if (digits(ka) !== digits(kb)) return null;
  const letters = Math.max(Array.from(ka).length, Array.from(kb).length);
  const d = slips(ka, kb);
  if (d > allowed(letters)) return null;
  // In a short name, a slip at the start is another word ("ice", "rice").
  if (letters <= 6 && Array.from(ka)[0] !== Array.from(kb)[0]) return null;
  // Word by word, when both have the same number of words: "mocha syrup" is
  // not "matcha syrup", though the whole names are only two letters apart.
  if (wa.length === wb.length && wa.length > 1) {
    for (let i = 0; i < wa.length; i++) {
      const n = Math.max(Array.from(wa[i]!).length, Array.from(wb[i]!).length);
      if (slips(wa[i]!, wb[i]!) > allowed(n)) return null;
    }
  }
  return d;
}

/**
 * The items already there whose names look like a new item's, the closest
 * first: each of its names (English, Arabic, Kurdish) against each of theirs.
 */
export function lookAlikes(candidate: NewNames, items: NamedItem[], limit = 3): LookAlike[] {
  const mine = [candidate.name, candidate.nameAr, candidate.nameCkb].filter(
    (n): n is string => !!n && n.trim() !== "",
  );
  if (mine.length === 0) return [];
  const key = nameKey(candidate.name);
  const found: (LookAlike & { distance: number })[] = [];
  for (const it of items) {
    const theirs = [it.name, it.nameAr, it.nameCkb].filter(
      (n): n is string => !!n && n.trim() !== "",
    );
    let best: number | null = null;
    for (const a of mine) {
      for (const b of theirs) {
        const d = lookAlike(a, b);
        if (d !== null && (best === null || d < best)) best = d;
      }
    }
    const same = key !== "" && nameKey(it.name) === key;
    if (same || best !== null) {
      found.push({ id: it.id, name: it.name, same, distance: same ? -1 : best! });
    }
  }
  return found
    .sort((x, y) => x.distance - y.distance || x.name.localeCompare(y.name))
    .slice(0, limit)
    .map(({ id, name, same }) => ({ id, name, same }));
}
