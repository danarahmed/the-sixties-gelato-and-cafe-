/**
 * Stock sent between the café's places (0054, release AB): a transfer as the
 * screens show it. It leaves one place at its cost there, is on its way in
 * 1210 Stock in transit, and arrives at the other — all of it, or less, what
 * did not arrive being lost — or is cancelled on its way, back where it was.
 */
export type TransferStatus = "sent" | "received" | "cancelled";

export interface TransferLine {
  id: string;
  itemId: string;
  item: string;
  /** As it was sent: 4 kg. */
  qty: number;
  unitCode: string;
  baseQty: number;
  baseUnit: string;
  value: number;
  /** What arrived, in the unit it was sent in; null until it is received. */
  qtyReceived: number | null;
  valueReceived: number | null;
}

export interface Transfer {
  id: string;
  no: number;
  status: TransferStatus;
  fromId: string;
  from: string;
  toId: string;
  to: string;
  note: string | null;
  value: number;
  valueReceived: number | null;
  valueShort: number | null;
  sentAt: string;
  sentBy: string | null;
  receivedAt: string | null;
  receivedBy: string | null;
  receiveNote: string | null;
  cancelledAt: string | null;
  cancelledBy: string | null;
  cancelReason: string | null;
  lines: TransferLine[];
}

/** Where a transfer stands, as the screens say it. */
export const TRANSFER_STATUS_LABEL: Record<TransferStatus, string> = {
  sent: "On its way",
  received: "Received",
  cancelled: "Cancelled",
};

/** A transfer's note, or what is said when it arrives, is at most this long. */
export const TRANSFER_NOTE_MAX = 500;

const n = (v: unknown): number => (v === null || v === undefined ? 0 : Number(v));
const nOrNull = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));
const s = (v: unknown): string => (v === null || v === undefined ? "" : String(v));
const sOrNull = (v: unknown): string | null => (v === null || v === undefined ? null : String(v));
const list = (v: unknown): Record<string, unknown>[] =>
  Array.isArray(v) ? (v as Record<string, unknown>[]) : [];
const statusOf = (v: unknown): TransferStatus =>
  v === "received" || v === "cancelled" ? v : "sent";

/** The transfers as the database gives them (stock_transfers). */
export function transfersFrom(raw: unknown): Transfer[] {
  return list(raw).map((t) => ({
    id: s(t.id),
    no: n(t.no),
    status: statusOf(t.status),
    fromId: s(t.from_id),
    from: s(t.from),
    toId: s(t.to_id),
    to: s(t.to),
    note: sOrNull(t.note),
    value: n(t.value),
    valueReceived: nOrNull(t.value_received),
    valueShort: nOrNull(t.value_short),
    sentAt: s(t.sent_at),
    sentBy: sOrNull(t.sent_by),
    receivedAt: sOrNull(t.received_at),
    receivedBy: sOrNull(t.received_by),
    receiveNote: sOrNull(t.receive_note),
    cancelledAt: sOrNull(t.cancelled_at),
    cancelledBy: sOrNull(t.cancelled_by),
    cancelReason: sOrNull(t.cancel_reason),
    lines: list(t.lines).map((l) => ({
      id: s(l.id),
      itemId: s(l.item_id),
      item: s(l.item),
      qty: n(l.qty),
      unitCode: s(l.unit_code),
      baseQty: n(l.base_qty),
      baseUnit: s(l.base_unit),
      value: n(l.value),
      qtyReceived: nOrNull(l.qty_received),
      valueReceived: nOrNull(l.value_received),
    })),
  }));
}
