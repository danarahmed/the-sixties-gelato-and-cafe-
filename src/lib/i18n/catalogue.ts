import "server-only";
/**
 * Every phrase the app has, for Settings → Languages: its key, its English,
 * and its built-in words in a language (Arabic and Kurdish have them). A
 * phrase kept by its English has no separate English.
 */
import { builtInWords, getDictionary } from "./dictionaries";
import { BOOKS } from "./phrases";

export interface Entry {
  /** The key: a dotted key ("pos.title"), or the English phrase itself. */
  k: string;
  /** The English, when the key is not the English itself. */
  e?: string;
  /** The built-in words in the language, when it has its own. */
  b?: string;
}

export function catalogue(locale: string): Entry[] {
  const en = getDictionary("en");
  const built = locale === "ar" || locale === "ckb" ? builtInWords(locale) : null;
  const seen = new Set<string>();
  const out: Entry[] = [];
  for (const [k, e] of Object.entries(en)) {
    seen.add(k);
    const b = built?.[k];
    out.push(b !== undefined && b !== e ? { k, e, b } : { k, e });
  }
  for (const book of Object.values(BOOKS))
    for (const k of Object.keys(book)) {
      if (seen.has(k)) continue;
      seen.add(k);
      const b = built?.[k];
      out.push(b !== undefined && b !== k ? { k, b } : { k });
    }
  return out;
}

/** A phrase's English, by its key. */
export function englishOf(key: string): string | null {
  const en = getDictionary("en");
  if (Object.prototype.hasOwnProperty.call(en, key)) return en[key] ?? null;
  for (const book of Object.values(BOOKS))
    if (Object.prototype.hasOwnProperty.call(book, key)) return key;
  return null;
}
