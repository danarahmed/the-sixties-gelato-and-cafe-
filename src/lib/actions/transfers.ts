"use server";
/**
 * Stock sent between the café's places (0054, release AB). Sent, it leaves
 * its place at its cost there into 1210 Stock in transit; received, it comes
 * into the other place, what did not arrive being lost; cancelled on its way,
 * it goes back where it was. Each keyed, for those who may send stock.
 */
import { z } from "zod";
import { badKey, callRpc, parse, refresh, type ActionResult } from "@/lib/db/rpc";
import { TRANSFER_NOTE_MAX } from "@/lib/transfers";
import { placeForWrite } from "@/lib/place";
import { id, nonNegative, optionalText, positive, text } from "@/lib/validation";

const PATHS = [
  "/inventory/transfers",
  "/inventory",
  "/production",
  "/purchasing/buying-list",
  "/reports",
  "/journals",
  "/dashboard",
];

const sendInput = z.object({
  /** Where it leaves from: this device's place when none is chosen. */
  fromId: z.string().uuid().nullable().optional(),
  toId: id("where the stock goes"),
  lines: z
    .array(
      z.object({
        itemId: id("an item"),
        qty: positive("Quantity"),
        unitCode: z.string().min(1, "Choose a unit"),
      }),
    )
    .min(1, "Add at least one line"),
  note: optionalText(TRANSFER_NOTE_MAX),
  /** The person has seen that it leaves stock below zero, and says it is right. */
  confirm: z.boolean().optional(),
});

/** Stock sent from one place to another: on its way until it is received. */
export async function sendTransferAction(
  input: z.input<typeof sendInput>,
  key: string,
): Promise<ActionResult<{ transferId: string; transferNo: number; value: number; to: string }>> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(sendInput, input);
  if (!v.ok) return v;
  const r = await callRpc<Record<string, unknown>>("send_stock_transfer", {
    p_from: v.data.fromId ?? (await placeForWrite()),
    p_to: v.data.toId,
    p_lines: v.data.lines.map((l) => ({ item_id: l.itemId, qty: l.qty, unit_code: l.unitCode })),
    p_note: v.data.note,
    p_confirm: v.data.confirm ?? false,
    p_idempotency_key: key,
  });
  if (!r.ok) return r;
  refresh(...PATHS);
  return {
    ok: true,
    data: {
      transferId: String(r.data.transfer_id ?? ""),
      transferNo: Number(r.data.transfer_no ?? 0),
      value: Number(r.data.value ?? 0),
      to: String(r.data.to ?? ""),
    },
  };
}

const receiveInput = z.object({
  transferId: id("a transfer"),
  /** What arrived of each line, as it was sent; none given: all of it. */
  lines: z
    .array(z.object({ lineId: id("a line"), qty: nonNegative("What arrived") }))
    .nullable()
    .optional(),
  note: optionalText(TRANSFER_NOTE_MAX),
});

/** A transfer received where it was sent: all of it, or what arrived. */
export async function receiveTransferAction(
  input: z.input<typeof receiveInput>,
  key: string,
): Promise<ActionResult<{ transferNo: number; received: number; short: number }>> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(receiveInput, input);
  if (!v.ok) return v;
  const r = await callRpc<Record<string, unknown>>("receive_stock_transfer", {
    p_transfer: v.data.transferId,
    p_lines: v.data.lines ? v.data.lines.map((l) => ({ line_id: l.lineId, qty: l.qty })) : null,
    p_note: v.data.note,
    p_idempotency_key: key,
  });
  if (!r.ok) return r;
  refresh(...PATHS);
  return {
    ok: true,
    data: {
      transferNo: Number(r.data.transfer_no ?? 0),
      received: Number(r.data.received ?? 0),
      short: Number(r.data.short ?? 0),
    },
  };
}

const cancelInput = z.object({
  transferId: id("a transfer"),
  reason: text("Why the transfer is cancelled", 500),
});

/** A transfer cancelled on its way: its stock goes back where it was. */
export async function cancelTransferAction(
  input: z.input<typeof cancelInput>,
  key: string,
): Promise<ActionResult<{ transferNo: number; from: string }>> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(cancelInput, input);
  if (!v.ok) return v;
  const r = await callRpc<Record<string, unknown>>("cancel_stock_transfer", {
    p_transfer: v.data.transferId,
    p_reason: v.data.reason,
    p_idempotency_key: key,
  });
  if (!r.ok) return r;
  refresh(...PATHS);
  return {
    ok: true,
    data: { transferNo: Number(r.data.transfer_no ?? 0), from: String(r.data.from ?? "") },
  };
}
