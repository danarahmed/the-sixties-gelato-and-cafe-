/** The kitchen's tickets (0110), as the station's screen shows them. Pure: the screens and tests read it. */

export interface KitchenTicketLine {
  name: string;
  qty: number;
  note: string | null;
  addons: string | null;
  seat: number | null;
}

export interface KitchenTicket {
  id: string;
  title: string;
  turnNo: number | null;
  channel: string | null;
  course: number | null;
  status: "new" | "ready" | "done";
  at: string;
  readyAt: string | null;
  station: string | null;
  lines: KitchenTicketLine[];
}

export function toKitchenTickets(v: unknown): KitchenTicket[] {
  return (Array.isArray(v) ? (v as Record<string, unknown>[]) : []).map((k) => ({
    id: String(k.id),
    title: String(k.title ?? ""),
    turnNo: k.turn_no == null ? null : Number(k.turn_no),
    channel: typeof k.channel === "string" ? k.channel : null,
    course: k.course == null ? null : Number(k.course),
    status: k.status === "ready" || k.status === "done" ? k.status : "new",
    at: String(k.at ?? ""),
    readyAt: typeof k.ready_at === "string" ? k.ready_at : null,
    station: typeof k.station === "string" ? k.station : null,
    lines: (Array.isArray(k.lines) ? (k.lines as Record<string, unknown>[]) : []).map((l) => ({
      name: String(l.name ?? ""),
      qty: Number(l.qty ?? 0),
      note: typeof l.note === "string" ? l.note : null,
      addons: typeof l.addons === "string" ? l.addons : null,
      seat: l.seat == null ? null : Number(l.seat),
    })),
  }));
}

/** How long a ticket has waited, in whole minutes. */
export function waitedMinutes(at: string, now: number): number {
  const t = Date.parse(at);
  return Number.isNaN(t) ? 0 : Math.max(0, Math.floor((now - t) / 60000));
}
