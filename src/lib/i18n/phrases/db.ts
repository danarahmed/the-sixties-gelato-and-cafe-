import type { PhraseBook } from "./types";

/**
 * What the database refuses with, by its English, with {1}, {2}… where it puts
 * a value (scripts/db-messages.mjs lists them; tests/i18n.test.ts checks that
 * each is here).
 */
const phrases: PhraseBook = {};

export default phrases;
