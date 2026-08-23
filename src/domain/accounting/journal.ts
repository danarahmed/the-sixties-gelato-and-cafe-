/**
 * Double-entry management ledger primitives.
 *
 * ACCOUNTING RULE: every journal entry must balance — total debits equal total
 * credits to the currency's precision — or it is rejected. Posting is
 * append-only; corrections are reversing entries, never edits.
 */
import { Money, type Currency } from "../money/money.js";

export type NormalBalance = "debit" | "credit";

export interface Account {
  code: string;
  name: string;
  type: "asset" | "liability" | "equity" | "revenue" | "expense";
  normalBalance: NormalBalance;
}

export interface JournalLine {
  accountCode: string;
  debit: Money;
  credit: Money;
  memo?: string;
}

export interface JournalEntry {
  id: string;
  /** UTC ISO-8601 timestamp. */
  occurredAt: string;
  description: string;
  lines: JournalLine[];
  referenceType?: string;
  referenceId?: string;
}

export function balanceOf(
  entry: JournalEntry,
  currency: Currency,
): { debit: Money; credit: Money } {
  const debit = Money.sum(
    entry.lines.map((l) => l.debit),
    currency,
  ).quantize();
  const credit = Money.sum(
    entry.lines.map((l) => l.credit),
    currency,
  ).quantize();
  return { debit, credit };
}

export function isBalanced(entry: JournalEntry, currency: Currency): boolean {
  const { debit, credit } = balanceOf(entry, currency);
  return debit.equals(credit);
}

/** Throws if the entry does not balance. Use before persisting any entry. */
export function assertBalanced(entry: JournalEntry, currency: Currency): void {
  const { debit, credit } = balanceOf(entry, currency);
  if (!debit.equals(credit)) {
    throw new Error(
      `Unbalanced journal entry "${entry.id}": debits ${debit.format()} != credits ${credit.format()}`,
    );
  }
  for (const line of entry.lines) {
    if (line.debit.isPositive() && line.credit.isPositive()) {
      throw new Error(`Journal line for ${line.accountCode} has both debit and credit`);
    }
  }
}

/** Build a reversing entry that negates the original (debits/credits swapped). */
export function reverseEntry(
  original: JournalEntry,
  meta: { id: string; occurredAt: string; reason: string },
): JournalEntry {
  return {
    id: meta.id,
    occurredAt: meta.occurredAt,
    description: `Reversal of ${original.id}: ${meta.reason}`,
    referenceType: "journal_entry",
    referenceId: original.id,
    lines: original.lines.map((l) => ({
      accountCode: l.accountCode,
      debit: l.credit,
      credit: l.debit,
      ...(l.memo !== undefined ? { memo: l.memo } : {}),
    })),
  };
}
