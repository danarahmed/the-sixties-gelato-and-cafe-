import "server-only";
/**
 * The bank reconciled against its statement (0059): what bank_book() says, as
 * the screen reads it. The database keeps the statements and checks each one.
 */
import { db, num, numOrNull, one, str, strOrNull } from "./client";

export interface BankLine {
  lineId: string;
  journalNo: number | null;
  day: string;
  description: string;
  /** In, above zero; out, below. */
  amount: number;
}

export interface BankStatementRow {
  id: string;
  statementNo: number;
  statementDate: string;
  openingBalance: number;
  closingBalance: number;
  lineCount: number;
  moneyIn: number;
  moneyOut: number;
  note: string | null;
  status: "kept" | "undone";
  by: string | null;
  at: string;
  undoReason: string | null;
}

export interface BankBook {
  to: string;
  /** What the books say the bank holds at the end of the day. */
  books: number;
  /** The last statement kept, or none yet. */
  last: { id: string; statementNo: number; statementDate: string; closingBalance: number } | null;
  /** The bank's lines on no statement yet, oldest first. */
  open: BankLine[];
  /** The statements, the latest first. */
  statements: BankStatementRow[];
}

const list = (v: unknown): Record<string, unknown>[] =>
  Array.isArray(v) ? (v as Record<string, unknown>[]) : [];

export async function getBankBook(to: string): Promise<BankBook> {
  const c = await db();
  const r = one<Record<string, unknown>>(await c.rpc("bank_book", { p_to: to }), "the bank") ?? {};
  const last = r.last && typeof r.last === "object" ? (r.last as Record<string, unknown>) : null;
  return {
    to: str(r.to) || to,
    books: num(r.books),
    last: last
      ? {
          id: str(last.id),
          statementNo: num(last.statement_no),
          statementDate: str(last.statement_date),
          closingBalance: num(last.closing_balance),
        }
      : null,
    open: list(r.open).map((l) => ({
      lineId: str(l.line_id),
      journalNo: numOrNull(l.journal_no),
      day: str(l.day),
      description: str(l.description),
      amount: num(l.amount),
    })),
    statements: list(r.statements).map((s) => ({
      id: str(s.id),
      statementNo: num(s.statement_no),
      statementDate: str(s.statement_date),
      openingBalance: num(s.opening_balance),
      closingBalance: num(s.closing_balance),
      lineCount: num(s.line_count),
      moneyIn: num(s.money_in),
      moneyOut: num(s.money_out),
      note: strOrNull(s.note),
      status: s.status === "undone" ? "undone" : "kept",
      by: strOrNull(s.by),
      at: str(s.at),
      undoReason: strOrNull(s.undo_reason),
    })),
  };
}
