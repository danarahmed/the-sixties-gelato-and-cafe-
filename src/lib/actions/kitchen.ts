"use server";
/** The restaurant's kitchen (0110): stations, tickets sent from the till, and the station's screen. */
import { z } from "zod";
import { callRpc, parse, refresh, type ActionResult } from "@/lib/db/rpc";
import { id, text } from "@/lib/validation";
import { toKitchenTickets, type KitchenTicket } from "@/lib/kitchen";

/** What a bill added or took off since the kitchen last had it; a course given, only its lines. */
export async function sendTabToKitchenAction(
  tabId: string,
  course: number | null = null,
): Promise<ActionResult<{ tickets: number; held: number }>> {
  const v = parse(
    z.object({ tabId: id("a bill"), course: z.number().int().min(1).max(5).nullable() }),
    { tabId, course },
  );
  if (!v.ok) return v;
  const r = await callRpc<{ tickets?: number; held?: number }>("send_tab_to_kitchen", {
    p_tab: v.data.tabId,
    p_course: v.data.course,
  });
  if (!r.ok) return r;
  return {
    ok: true,
    data: { tickets: Number(r.data.tickets ?? 0), held: Number(r.data.held ?? 0) },
  };
}

/** A sale at the counter, to the kitchen whole. */
export async function sendSaleToKitchenAction(orderId: string): Promise<ActionResult<null>> {
  const v = parse(z.object({ orderId: id("a sale") }), { orderId });
  if (!v.ok) return v;
  const r = await callRpc("send_sale_to_kitchen", { p_order: v.data.orderId });
  return r.ok ? { ok: true, data: null } : r;
}

/** A station's tickets now (all stations: null with all). */
export async function kitchenTicketsAction(
  stationId: string | null,
  all: boolean,
): Promise<ActionResult<KitchenTicket[]>> {
  const v = parse(z.object({ stationId: id("a station").nullable(), all: z.boolean() }), {
    stationId,
    all,
  });
  if (!v.ok) return v;
  const r = await callRpc<unknown>("kitchen_tickets", {
    p_station: v.data.stationId,
    p_all: v.data.all,
  });
  if (!r.ok) return r;
  return { ok: true, data: toKitchenTickets(r.data) };
}

export async function setTicketStatusAction(
  ticketId: string,
  status: "new" | "ready" | "done",
): Promise<ActionResult<null>> {
  const v = parse(
    z.object({ ticketId: id("a ticket"), status: z.enum(["new", "ready", "done"]) }),
    {
      ticketId,
      status,
    },
  );
  if (!v.ok) return v;
  const r = await callRpc("set_ticket_status", {
    p_ticket: v.data.ticketId,
    p_status: v.data.status,
  });
  return r.ok ? { ok: true, data: null } : r;
}

export async function saveStationAction(input: {
  id: string | null;
  name: string;
  active: boolean;
}): Promise<ActionResult<null>> {
  const v = parse(
    z.object({ id: id("a station").nullable(), name: text("Name", 40), active: z.boolean() }),
    input,
  );
  if (!v.ok) return v;
  const r = await callRpc("save_kitchen_station", {
    p_id: v.data.id,
    p_name: v.data.name,
    p_active: v.data.active,
  });
  if (!r.ok) return r;
  refresh("/settings", "/kitchen");
  return { ok: true, data: null };
}

export async function setCategoryStationAction(
  categoryId: string,
  stationId: string | null,
): Promise<ActionResult<null>> {
  const v = parse(
    z.object({ categoryId: id("a category"), stationId: id("a station").nullable() }),
    {
      categoryId,
      stationId,
    },
  );
  if (!v.ok) return v;
  const r = await callRpc("set_category_station", {
    p_category: v.data.categoryId,
    p_station: v.data.stationId,
  });
  if (!r.ok) return r;
  refresh("/settings");
  return { ok: true, data: null };
}
