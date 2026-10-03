/**
 * The app's languages, and the translator every screen uses, on the server
 * and in the browser. The words are not here: the server gives each page the
 * words of the reader's language (the built-in ones, and any the owner has
 * corrected or added on Settings → Languages), so a screen carries one
 * language's words, not every language's.
 *
 * A key is either a dotted key ("pos.title") or the English text itself
 * ("Waiting to be paid out"); a language without a word for it shows the
 * English. {name} in a phrase is filled from the values given.
 */

/** A language's code: en, ar, ckb, or one the owner added (tr, fa, kmr…). */
export type Locale = string;

export type Dir = "ltr" | "rtl";

export interface Language {
  code: Locale;
  /** Its name, written in itself: English, العربية, کوردی. */
  label: string;
  dir: Dir;
  /** Built in (English, Arabic, Kurdish), or added by the owner. */
  builtIn: boolean;
}

export const BUILT_IN_LANGUAGES: Language[] = [
  { code: "en", label: "English", dir: "ltr", builtIn: true },
  { code: "ar", label: "العربية", dir: "rtl", builtIn: true },
  { code: "ckb", label: "کوردی", dir: "rtl", builtIn: true },
];

/** A language's words, by key. */
export type Words = Record<string, string>;

export type Vars = Record<string, string | number>;

/** Translate a key, filling its {placeholders}. */
export type T = (key: string, vars?: Vars) => string;

/** A date, a month or a time of day as the app writes one: 2026-09-30, 2026-09, 2026-09-30 14:05. */
const DATE = /(?<![\d\u2066])\d{4}-\d{2}(?:-\d{2})?(?:[ T]\d{2}:\d{2}(?::\d{2})?)?(?!\d)/g;

/**
 * The dates in a text kept left to right, each on its own. Among Arabic or
 * Kurdish words a browser shows 2026-09-30 as 30-09-2026, while the same date
 * standing alone, in a table's cell, shows as it is written: marked off
 * (U+2066 … U+2069, which show as nothing), it shows as written everywhere.
 */
export function isolateDates(text: string): string {
  return text.replace(DATE, (d) => `\u2066${d}\u2069`);
}

/** A number as the app writes one: 3, 1,646, 2.36, -77. */
const NUMBER = /-?\d[\d,]*(?:\.\d+)?/g;

/**
 * An English word whose plural is left open, "bill(s)", "loss(es)", "month(s)'",
 * and a verb right after it that agrees with it.
 */
const OPEN_PLURAL = /\b([A-Za-z]+)\((e?s)\)(')?(?:(\s+)(are|have|do|wait|differ|need)\b)?/g;

const SINGULAR: Record<string, string> = {
  are: "is",
  have: "has",
  do: "does",
  wait: "waits",
  differ: "differs",
  need: "needs",
};

/**
 * An English word whose plural a phrase leaves open ("{n} bill(s) are still
 * open") made to agree with the number nearest before it: "1 bill is still
 * open", "3 bills are still open". With no number before it, the plural.
 * Arabic and Kurdish words never leave a plural open, and are left as they are.
 */
export function agree(text: string): string {
  if (!text.includes("(")) return text;
  return text.replace(
    OPEN_PLURAL,
    (
      _whole,
      word: string,
      ending: string,
      apostrophe: string | undefined,
      space: string | undefined,
      verb: string | undefined,
      at: number,
    ) => {
      const numbers = text.slice(0, at).match(NUMBER);
      const last = numbers?.[numbers.length - 1];
      const one = last !== undefined && Number(last.replace(/,/g, "")) === 1;
      const owner = apostrophe ? (one ? "'s" : "'") : "";
      const said = verb ? `${space ?? " "}${one ? (SINGULAR[verb] ?? verb) : verb}` : "";
      return `${one ? word : word + ending}${owner}${said}`;
    },
  );
}

/**
 * {name} in a phrase, filled; a placeholder with no value is left as it is.
 * For a right-to-left reader, the dates in a value are kept left to right.
 * A plural the phrase leaves open agrees with its number.
 */
export function fill(text: string, vars?: Vars, dir: Dir = "ltr"): string {
  if (!vars) return agree(text);
  return agree(
    text.replace(/\{(\w+)\}/g, (whole, name: string) => {
      if (!Object.prototype.hasOwnProperty.call(vars, name)) return whole;
      const value = String(vars[name]);
      return dir === "rtl" ? isolateDates(value) : value;
    }),
  );
}

/** The translator for a language's words: the key itself (an English phrase) where it has none. */
export function translator(words: Words, dir: Dir = "ltr"): T {
  return (key, vars) => fill(words[key] ?? key, vars, dir);
}

/** The arrow that points on, and the one that points back, the way a direction reads. */
export function arrows(dir: Dir): { on: string; back: string } {
  return dir === "rtl" ? { on: "←", back: "→" } : { on: "→", back: "←" };
}

/** A language's direction, from the languages the café has. */
export function dirOf(languages: readonly Language[], locale: Locale): Dir {
  return languages.find((l) => l.code === locale)?.dir ?? "ltr";
}

/** A message the server or the database sends, in the reader's language. */
export type Msg = (text: string) => string;

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const letters = (s: string) => (s.match(/[A-Za-z]/g) ?? []).length;

/** An account's code and name, as the books show one: "6000 Rent". */
const ACCOUNT = /^(\d{4}) (.+)$/s;

/** "05 Sep" or "05 Sep 14:30", as the database writes a date in a message. */
const SHORT_DATE = /^(\d{1,2}) ([A-Z][a-z]{2})((?: \d{2}:\d{2})?)$/;

/**
 * The translator for messages: an error from a form or from the database, an
 * alert, the daily brief. A message is a phrase, or one of the database's
 * with values put in: its English is kept with {1}, {2}… where they go ("{1} is
 * no longer in use…"), and each value is itself translated when it is a phrase
 * ("under a day"), a phrase with values ("{1} days"), or a date ("05 Sep").
 *
 * A whole message is matched only by a phrase whose own words pin it down: six
 * letters or more, or a start of four ("Waste {1}."). A shorter one ("{1}
 * days") is for the values inside a message, where it cannot swallow another.
 * Messages the database joins with "; " are translated one by one.
 */
export function messenger(words: Words, dir: Dir = "ltr"): Msg {
  type Pattern = { re: RegExp; slots: number[]; to: string; fixed: number; whole: boolean };
  let patterns: Pattern[] | null = null;
  const compile = (): Pattern[] =>
    Object.entries(words)
      .filter(([k]) => /\{\d+\}/.test(k))
      .map(([k, to]) => {
        const parts = k.split(/\{\d+\}/);
        return {
          // A value never spans a "; ": that is where a list of messages is joined.
          re: new RegExp(`^${parts.map(escapeRe).join("([^;]+?)")}$`),
          slots: [...k.matchAll(/\{(\d+)\}/g)].map((m) => Number(m[1])),
          to,
          fixed: parts.join("").length,
          whole: letters(parts.join("")) >= 6 || letters(parts[0] ?? "") >= 4,
        };
      })
      .sort((a, b) => b.fixed - a.fixed);
  const translate = (text: string, depth: number): string => {
    const exact = words[text];
    if (exact !== undefined) return exact;
    // An account by its code and name, "6000 Rent": the name the database gave it.
    const account = ACCOUNT.exec(text);
    const named = account ? words[account[2]!] : undefined;
    if (account && named !== undefined) return `${account[1]} ${named}`;
    if (depth > 0) {
      const d = SHORT_DATE.exec(text);
      const month = d ? words[d[2]!] : undefined;
      if (d && month !== undefined) return `${d[1]} ${month}${d[3]}`;
    }
    if (depth > 2) return text;
    patterns ??= compile();
    for (const p of patterns) {
      if (depth === 0 && !p.whole) continue;
      const m = p.re.exec(text);
      if (!m) continue;
      const values: Record<string, string> = {};
      p.slots.forEach((slot, i) => (values[slot] = translate(m[i + 1] ?? "", depth + 1)));
      return p.to.replace(/\{(\d+)\}/g, (whole, n: string) => values[n] ?? whole);
    }
    // Messages joined into a list: each one on its own, the ones after the
    // first as the values they are ("Label — detail").
    if (text.includes("; ")) {
      const parts = text.split("; ");
      return parts
        .map((part, i) => translate(part, i === 0 ? depth : Math.max(depth, 1)))
        .join(words["; "] ?? "; ");
    }
    return text;
  };
  return (text) => {
    if (!text) return text;
    const said = agree(translate(text, 0));
    return dir === "rtl" ? isolateDates(said) : said;
  };
}
