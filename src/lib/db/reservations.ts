import "server-only";
/** Reservations and the waiting list (0110). Null before 0110, or with the part off. */
import { db } from "./client";

export interface Reservation {
  id: string;
  name: string;
  phone: string | null;
  party: number;
  at: string | null;
  status: "booked" | "seated" | "cancelled" | "no_show";
  note: string | null;
  tableId: string | null;
  table: string | null;
  waiting: boolean;
  createdAt: string;
}

export async function getReservations(day: string | null): Promise<Reservation[] | null> {
  const c = await db();
  const r = await c.rpc("reservations", { p_day: day });
  if (r.error || !Array.isArray(r.data)) return null;
  return (r.data as Record<string, unknown>[]).map((x) => ({
    id: String(x.id),
    name: String(x.name ?? ""),
    phone: typeof x.phone === "string" ? x.phone : null,
    party: Number(x.party ?? 1),
    at: typeof x.at === "string" ? x.at : null,
    status: (["seated", "cancelled", "no_show"].includes(String(x.status))
      ? String(x.status)
      : "booked") as Reservation["status"],
    note: typeof x.note === "string" ? x.note : null,
    tableId: typeof x.table_id === "string" ? x.table_id : null,
    table: typeof x.table === "string" ? x.table : null,
    waiting: x.waiting === true,
    createdAt: String(x.created_at ?? ""),
  }));
}

export async function getTablesForBooking(): Promise<
  { id: string; name: string; seats: number | null }[]
> {
  const c = await db();
  const r = await c
    .from("dining_table")
    .select("id,name,seats,is_active")
    .eq("is_active", true)
    .order("sort_order");
  return ((r.data ?? []) as { id: string; name: string; seats: number | null }[]).map((x) => ({
    id: x.id,
    name: x.name,
    seats: x.seats,
  }));
}
