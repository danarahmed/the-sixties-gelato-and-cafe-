/**
 * The reasons a void, refund, discount or cancelled bill is given from (0028,
 * the audit's P1-10), as the database lists them in reason_code. The screens
 * show them in the person's language (reason.<kind>.<code>); the database
 * keeps the English label, and a note in the person's own words.
 * tests/app-rules.test.ts fails if this list and the migration's differ.
 */
export const REASONS = {
  void: ["rang_wrong_item", "rang_twice", "wrong_channel", "customer_left", "other"],
  refund: ["changed_mind", "quality", "wrong_order", "overcharged", "other"],
  discount: ["staff_meal", "on_the_house", "regular", "complaint", "promotion", "other"],
  bill_cancel: ["customer_left", "opened_by_mistake", "moved", "other"],
} as const;

export type ReasonKind = keyof typeof REASONS;

/** The dictionary key for a reason's label. */
export function reasonKey(kind: ReasonKind, code: string): string {
  return code === "other" ? "reason.other" : `reason.${kind}.${code}`;
}

/**
 * Enough for "Other", as the database checks it (reason_text): two words or
 * more, with at least six letters between them — not "x" or a key held down.
 */
export function noteIsEnough(note: string): boolean {
  const words = note.trim().split(/\s+/).filter(Boolean);
  const letters = note.replace(/[\s\d!-/:-@[-`{-~]/g, "");
  return words.length >= 2 && [...letters].length >= 6;
}

/** What is still missing from a reason: one chosen from the list, or the words "Other" needs. */
export function reasonMissing(code: string | null, note: string): "choose" | "say" | null {
  if (!code) return "choose";
  if (code === "other" && !noteIsEnough(note)) return "say";
  return null;
}
