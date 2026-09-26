/**
 * Phrases of the screens by their English text, each in Arabic and in Kurdish
 * (Sorani). {name} marks a value filled in; <b>…</b> and named tags mark words
 * shown differently (see Rich). A translation keeps every placeholder and tag.
 */
export type PhraseBook = Record<string, { ar: string; ckb: string }>;
