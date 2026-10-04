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

/** A count's forms in a phrase, ICU's way: "{n, plural, one {…} two {…} few {# …} other {# …}}". */
const PLURAL_HEAD = /\{(\w+), plural,/g;

export interface PluralBlock {
  /** Where the block starts and ends in the phrase. */
  start: number;
  end: number;
  /** The count it is chosen by: a placeholder's name ("n"), or a message's value ("1"). */
  name: string;
  /** Each form by its category ("one", "two", "few", "many", "other") or "=0"; # is the count. */
  forms: Map<string, string>;
}

/** The count blocks of a phrase; one written wrong ends the reading, and is left as written. */
export function pluralBlocks(text: string): PluralBlock[] {
  const out: PluralBlock[] = [];
  const head = new RegExp(PLURAL_HEAD);
  let m: RegExpExecArray | null;
  while ((m = head.exec(text))) {
    let i = m.index + m[0].length;
    const forms = new Map<string, string>();
    for (;;) {
      while (i < text.length && /\s/.test(text[i]!)) i++;
      if (text[i] === "}") {
        i++;
        break;
      }
      const sel = /^(=\d+|zero|one|two|few|many|other)\s*\{/.exec(text.slice(i));
      if (!sel) return out;
      i += sel[0].length;
      const from = i;
      for (let depth = 1; depth > 0; i++) {
        if (i >= text.length) return out;
        if (text[i] === "{") depth++;
        else if (text[i] === "}") depth--;
      }
      forms.set(sel[1]!, text.slice(from, i - 1));
    }
    out.push({ start: m.index, end: i, name: m[1]!, forms });
    head.lastIndex = i;
  }
  return out;
}

const RULES = new Map<string, Intl.PluralRules>();

/** A number's category in a language: Arabic's one, two, few (3–10), many (11–99) and other. */
function categoryOf(locale: string, n: number): string {
  let rules = RULES.get(locale);
  if (!rules) {
    try {
      rules = new Intl.PluralRules(locale);
    } catch {
      rules = new Intl.PluralRules("en");
    }
    RULES.set(locale, rules);
  }
  return rules.select(n);
}

/**
 * Each count in a phrase in the form its language gives that number: in
 * Arabic, "فاتورة واحدة", "فاتورتان", "3 فواتير", "11 فاتورة". A form is chosen
 * by the number itself (=0), then by the language's rules, then "other"; # in
 * it is the count as given. A count with no value is left as written.
 */
export function plurals(text: string, values: Record<string, unknown>, locale: string): string {
  if (!text.includes(", plural,")) return text;
  let out = "";
  let at = 0;
  for (const b of pluralBlocks(text)) {
    if (!Object.prototype.hasOwnProperty.call(values, b.name)) continue;
    const value = String(values[b.name]);
    const n = Number(value.replace(/,/g, ""));
    const form =
      b.forms.get(`=${n}`) ??
      (Number.isFinite(n) ? b.forms.get(categoryOf(locale, n)) : undefined) ??
      b.forms.get("other") ??
      "";
    out += text.slice(at, b.start) + form.replace(/#/g, value);
    at = b.end;
  }
  return out + text.slice(at);
}

/**
 * A phrase with each count written in its "other" form, # as the count's
 * {placeholder}: what its words must keep of the English, {placeholders} and
 * <marks> alike.
 */
export function flatPlurals(text: string): string {
  let out = "";
  let at = 0;
  for (const b of pluralBlocks(text)) {
    out += text.slice(at, b.start) + (b.forms.get("other") ?? "").replace(/#/g, `{${b.name}}`);
    at = b.end;
  }
  return out + text.slice(at);
}

const tagsOf = (s: string) => [...s.matchAll(/<\/?[a-z][a-z0-9]*>/gi)].map((m) => m[0]).sort();
const namesOf = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

/**
 * Whether each count in a phrase is written whole: every block read to its
 * end, an "other" form with the count (#) in it, and each form with the same
 * {placeholders} and <marks> as the "other" one.
 */
export function pluralsWhole(text: string): boolean {
  const blocks = pluralBlocks(text);
  if (blocks.length !== text.split(", plural,").length - 1) return false;
  return blocks.every((b) => {
    const other = b.forms.get("other");
    if (other === undefined || !other.includes("#")) return false;
    const marks = (f: string) => [...namesOf(f), ...tagsOf(f)].join();
    return [...b.forms.values()].every((f) => marks(f) === marks(other));
  });
}

/** What parts the café's words as the database keeps them from the words as written. */
const KEPT = "⁣";

/**
 * The café's words as the database keeps them (0032). Its check wants each
 * {placeholder} of the English as often as the English has it, and does not
 * read a count's forms, so words with forms are kept as their flat words (each
 * count in its "other" form), then, after an invisible separator, the words as
 * written, their braces as ⟪ ⟫. Words with no forms are kept as they are.
 */
export function keptWords(words: string): string {
  if (pluralBlocks(words).length === 0) return words;
  const braces = words.replace(/[{}]/g, (c) => (c === "{" ? "⟪" : "⟫"));
  return `${flatPlurals(words)}${KEPT}${braces}`;
}

/** The café's words as they were written, from the words the database keeps. */
export function writtenWords(kept: string): string {
  const at = kept.lastIndexOf(KEPT);
  if (at < 0) return kept;
  return kept.slice(at + KEPT.length).replace(/[⟪⟫]/g, (c) => (c === "⟪" ? "{" : "}"));
}

/** The marks the café's words are kept with, taken out of the words as written. */
export const keptMarks = (words: string) => words.replace(/[⁣⟪⟫]/g, "");

/**
 * {name} in a phrase, filled; a placeholder with no value is left as it is.
 * For a right-to-left reader, the dates in a value are kept left to right.
 * A count takes the form its language gives that number, and an English
 * plural the phrase leaves open agrees with its number.
 */
export function fill(text: string, vars?: Vars, dir: Dir = "ltr", locale: Locale = "en"): string {
  if (!vars) return agree(text);
  return agree(
    plurals(text, vars, locale).replace(/\{(\w+)\}/g, (whole, name: string) => {
      if (!Object.prototype.hasOwnProperty.call(vars, name)) return whole;
      const value = String(vars[name]);
      return dir === "rtl" ? isolateDates(value) : value;
    }),
  );
}

/** The translator for a language's words: the key itself (an English phrase) where it has none. */
export function translator(words: Words, dir: Dir = "ltr", locale: Locale = "en"): T {
  return (key, vars) => fill(words[key] ?? key, vars, dir, locale);
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
export function messenger(words: Words, dir: Dir = "ltr", locale: Locale = "en"): Msg {
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
      return plurals(p.to, values, locale).replace(
        /\{(\d+)\}/g,
        (whole, n: string) => values[n] ?? whole,
      );
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
