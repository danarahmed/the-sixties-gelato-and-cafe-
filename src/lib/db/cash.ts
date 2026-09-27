import "server-only";
/**
 * The drawer in sessions (0036, release K): its state for the till, the list
 * of sessions and one session's statement. Each is a database function run as
 * the signed-in person, and none shows what an open drawer should hold to
 * anyone who may not see it.
 */
import { drawerStateFrom, type DrawerState } from "@/lib/cash";
import { db, num, numOrNull, one, rows, str, strOrNull } from "./client";

export async function getDrawerState(): Promise<DrawerState> {
  const c = await db();
  return drawerStateFrom(
    one(await c.rpc("cash_session_status"), "the drawer") as Record<string, unknown> | null,
  );
}

export interface CashSessionRow {
  id: string;
  /** A session; before them, a drawer count, or a day closed the old way. */
  kind: "session" | "drawer" | "day";
  no: number | null;
  location: string;
  cashier: string | null;
  openedAt: string;
  openedBy: string | null;
  closedAt: string | null;
  closedBy: string | null;
  isOpen: boolean;
  /** Closed by a manager, and why. */
  forcedReason: string | null;
  openingCounted: number | null;
  openingExpected: number | null;
  openingVariance: number | null;
  cashSales: number | null;
  refunds: number | null;
  voids: number | null;
  paidOut: number | null;
  cashIn: number | null;
  cashOut: number | null;
  /** Null for an open session, unless the reader may see what it should hold. */
  expected: number | null;
  counted: number | null;
  variance: number | null;
  left: number | null;
  taken: number | null;
  takenTo: string | null;
  card: number | null;
  orders: number | null;
  /** Handed over from this session. */
  openedFromNo: number | null;
  /** The first session, which took over from the drawer counts. */
  tookOver: boolean;
  /** Handed over to this session. */
  handedToNo: number | null;
}

function sessionRow(r: Record<string, unknown>): CashSessionRow {
  return {
    id: str(r.id),
    kind: str(r.kind) as CashSessionRow["kind"],
    no: numOrNull(r.session_no),
    location: str(r.location),
    cashier: strOrNull(r.cashier),
    openedAt: str(r.opened_at),
    openedBy: strOrNull(r.opened_by),
    closedAt: strOrNull(r.closed_at),
    closedBy: strOrNull(r.closed_by),
    isOpen: r.is_open === true,
    forcedReason: strOrNull(r.forced_reason),
    openingCounted: numOrNull(r.opening_counted),
    openingExpected: numOrNull(r.opening_expected),
    openingVariance: numOrNull(r.opening_variance),
    cashSales: numOrNull(r.cash_sales),
    refunds: numOrNull(r.refunds),
    voids: numOrNull(r.voids),
    paidOut: numOrNull(r.paid_out),
    cashIn: numOrNull(r.cash_in),
    cashOut: numOrNull(r.cash_out),
    expected: numOrNull(r.expected),
    counted: numOrNull(r.counted),
    variance: numOrNull(r.variance),
    left: numOrNull(r.left_in_drawer),
    taken: numOrNull(r.taken_out),
    takenTo: strOrNull(r.taken_to),
    card: numOrNull(r.card),
    orders: numOrNull(r.orders),
    openedFromNo: numOrNull(r.opened_from_no),
    tookOver: r.took_over === true,
    handedToNo: numOrNull(r.handed_to_no),
  };
}

/** Sessions opened or closed in the dates, or still open, newest first. */
export async function getCashSessions(from: string, to: string): Promise<CashSessionRow[]> {
  const c = await db();
  return rows(await c.rpc("cash_sessions", { p_from: from, p_to: to }), "the cash sessions").map(
    sessionRow,
  );
}

export interface SessionMovement {
  at: string;
  kind: string;
  amount: number;
  by: string | null;
  referenceType: string;
  referenceId: string;
  turnNo: number | null;
  note: string | null;
}

export interface SessionStatement {
  session: CashSessionRow;
  notes: { opening: Record<string, number> | null; closing: Record<string, number> | null };
  movements: SessionMovement[];
  takings: { at: string; to: string; amount: number; journalNo: number | null }[];
}

export async function getSessionStatement(id: string): Promise<SessionStatement> {
  const c = await db();
  const s = one(await c.rpc("cash_session_statement", { p_session: id }), "the session") as Record<
    string,
    unknown
  >;
  const notes = (s.notes ?? {}) as Record<string, Record<string, number> | null>;
  return {
    session: sessionRow(s.session as Record<string, unknown>),
    notes: { opening: notes.opening ?? null, closing: notes.closing ?? null },
    movements: ((s.events as Record<string, unknown>[] | null) ?? []).map((e) => ({
      at: str(e.at),
      kind: str(e.kind),
      amount: num(e.amount),
      by: strOrNull(e.by),
      referenceType: str(e.reference_type),
      referenceId: str(e.reference_id),
      turnNo: numOrNull(e.turn_no),
      note: strOrNull(e.note),
    })),
    takings: ((s.takings as Record<string, unknown>[] | null) ?? []).map((t) => ({
      at: str(t.at),
      to: str(t.to),
      amount: num(t.amount),
      journalNo: numOrNull(t.journal_no),
    })),
  };
}
