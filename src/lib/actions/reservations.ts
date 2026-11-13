"use server";
/** Reservations and the waiting list (0110). */
import { z } from "zod";
import { callRpc, parse, refresh, type ActionResult } from "@/lib/db/rpc";
import { id, optionalText, text } from "@/lib/validation";

export async function saveReservationAction(input: {
  id: string | null;
  name: string;
  phone: string | null;
  party: number;
  /** When, as the browser has it (an ISO time); null: waiting now. */
  at: string | null;
  note: string | null;
  tableId: string | null;
}): Promise<ActionResult<null>> {
  const v = parse(
    z.object({
      id: id("a booking").nullable(),
      name: text("Name", 80),
      phone: optionalText(30),
      party: z
        .number()
        .int("A party is from 1 to 100 people")
        .min(1, "A party is from 1 to 100 people")
        .max(100, "A party is from 1 to 100 people"),
      at: z.string().datetime({ offset: true, message: "Choose when" }).nullable(),
      note: optionalText(300),
      tableId: id("a table").nullable(),
    }),
    input,
  );
  if (!v.ok) return v;
  const r = await callRpc("save_reservation", {
    p_id: v.data.id,
    p_name: v.data.name,
    p_phone: v.data.phone,
    p_party: v.data.party,
    p_at: v.data.at,
    p_note: v.data.note,
    p_table: v.data.tableId,
  });
  if (!r.ok) return r;
  refresh("/reservations");
  return { ok: true, data: null };
}

export async function setReservationStatusAction(input: {
  id: string;
  status: "booked" | "seated" | "cancelled" | "no_show";
  tableId: string | null;
}): Promise<ActionResult<null>> {
  const v = parse(
    z.object({
      id: id("a booking"),
      status: z.enum(["booked", "seated", "cancelled", "no_show"]),
      tableId: id("a table").nullable(),
    }),
    input,
  );
  if (!v.ok) return v;
  const r = await callRpc("set_reservation_status", {
    p_id: v.data.id,
    p_status: v.data.status,
    p_table: v.data.tableId,
  });
  if (!r.ok) return r;
  refresh("/reservations");
  return { ok: true, data: null };
}
