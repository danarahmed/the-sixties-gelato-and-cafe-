/**
 * The words the screens use: every phrase's English, which the phrase books
 * translate and Settings → Languages gives the café's own words. An account's
 * Arabic and Kurdish are kept as the café's words for its name, so an account
 * named as one of them, and given words, would give that word its words on
 * every screen ("Delivery", "Other"). Read on the server only, with the phrase
 * books.
 */
import { BOOKS } from "./phrases";

const WORDS = new Set(Object.values(BOOKS).flatMap((book) => Object.keys(book)));

/** Whether a name, as the database keeps it (trimmed, one space between words), is a word the screens use. */
export function isScreenWord(name: string): boolean {
  return WORDS.has(name.trim().replace(/\s+/g, " "));
}

/** Added as a word the screens use, with its own Arabic or Kurdish. */
export const SCREEN_WORD_NAME =
  "A word the screens use has its Arabic and Kurdish already: add the account without other names, or give it a name of its own (“Delivery costs”, not “Delivery”)";

/** Renamed as a word the screens use: its words, given or carried from its old name, would be that word's. */
export const SCREEN_WORD_RENAME =
  "An account is not renamed as a word the screens use: its Arabic and Kurdish would change that word on every screen (“Delivery costs”, not “Delivery”)";

/**
 * Why an account's name is refused as a word the screens use, or null. Added
 * without other names, it writes no words, and shows the screens' own. Renamed,
 * the database carries its words from its old name, so it is refused either way.
 */
export function screenWordRefusal(
  name: string,
  givesWords: boolean,
  renaming: boolean,
): string | null {
  if (!isScreenWord(name)) return null;
  if (renaming) return SCREEN_WORD_RENAME;
  return givesWords ? SCREEN_WORD_NAME : null;
}
