/**
 * Every phrase of the screens, by area, in Arabic and Kurdish. Read on the
 * server only: a page is given the words of its reader's language.
 */
import type { PhraseBook } from "./types";
import common from "./common";
import books from "./books";
import sales from "./sales";
import stock from "./stock";
import reports from "./reports";
import menu from "./menu";
import platforms from "./platforms";
import settings from "./settings";
import db from "./db";

/** The areas' phrase books; "db" holds the database's messages, alerts and brief. */
export const BOOKS: Record<string, PhraseBook> = {
  common,
  books,
  sales,
  stock,
  reports,
  menu,
  platforms,
  settings,
  db,
};

const byLocale = new Map<string, Record<string, string>>();

/** A built-in language's phrases (Arabic, Kurdish), by their English text. */
export function phrasesIn(locale: string): Record<string, string> {
  if (locale !== "ar" && locale !== "ckb") return {};
  let words = byLocale.get(locale);
  if (!words) {
    words = {};
    for (const book of Object.values(BOOKS))
      for (const [en, t] of Object.entries(book)) words[en] = t[locale];
    byLocale.set(locale, words);
  }
  return words;
}
