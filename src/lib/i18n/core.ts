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

/** {name} in a phrase, filled; a placeholder with no value is left as it is. */
export function fill(text: string, vars?: Vars): string {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (whole, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : whole,
  );
}

/** The translator for a language's words: the key itself (an English phrase) where it has none. */
export function translator(words: Words): T {
  return (key, vars) => fill(words[key] ?? key, vars);
}

/** A language's direction, from the languages the café has. */
export function dirOf(languages: readonly Language[], locale: Locale): Dir {
  return languages.find((l) => l.code === locale)?.dir ?? "ltr";
}

/** A message the server or the database sends, in the reader's language. */
export type Msg = (text: string) => string;

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const letters = (s: string) => (s.match(/[A-Za-z]/g) ?? []).length;

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
 */
export function messenger(words: Words): Msg {
  type Pattern = { re: RegExp; slots: number[]; to: string; fixed: number; whole: boolean };
  let patterns: Pattern[] | null = null;
  const compile = (): Pattern[] =>
    Object.entries(words)
      .filter(([k]) => /\{\d+\}/.test(k))
      .map(([k, to]) => {
        const parts = k.split(/\{\d+\}/);
        return {
          re: new RegExp(`^${parts.map(escapeRe).join("(.+?)")}$`, "s"),
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
    return text;
  };
  return (text) => (text ? translate(text, 0) : text);
}
