"use server";
/**
 * Bills that are paid later, and the tables they belong to. A bill is not a
 * sale: nothing reaches the books until it is paid, and then settle_tab
 * records it through record_sale, exactly like a sale at the counter.
 *
 * Every change names the version of the bill the till is showing; a till
 * working from an old copy is refused rather than overwriting another till's
 * work. Each action returns the open bills as they now stand, so every till
 * shows the same thing.
 */
import { z } from "zod";
import { callRpc, parse, refresh, type ActionResult } from "@/lib/db/rpc";
import { parseOpenBills, type OpenBill } from "@/lib/db/pos";
import {
  discountAmount,
  discountPercent,
  id,
  optionalNonNegative,
  optionalText,
  positive,
  salesChannel,
  text,
} from "@/lib/validation";
import type { SaleReceipt } from "@/lib/actions/sales";

/** A paid bill changes these screens; the till itself is kept current by the action's answer. */
const PAID_PATHS = ["/orders", "/sales", "/dashboard", "/inventory", "/reports", "/journals"];

const version = z.number().int().positive("This bill has no version");
const lines = z.array(
  z.object({
    variantId: id("a product"),
    qty: positive("Quantity"),
    note: optionalText(200),
  }),
);
const toDb = (ls: { variantId: string; qty: string | number; note?: string | null }[]) =>
  ls.map((l) => ({ variant_id: l.variantId, qty: l.qty, ...(l.note ? { note: l.note } : {}) }));

async function openBills(): Promise<ActionResult<OpenBill[]>> {
  const r = await callRpc<unknown>("pos_open_bills");
  return r.ok ? { ok: true, data: parseOpenBills(r.data) } : r;
}

/** The open bills now — the till asks every few seconds, to see other tills' work. */
export async function openBillsAction(): Promise<ActionResult<OpenBill[]>> {
  return openBills();
}

/** The bills after a change that went through. If only the re-read fails, say so, not that the change did. */
async function withBills<T>(data: T): Promise<ActionResult<T & { bills: OpenBill[] | null }>> {
  const b = await openBills();
  return { ok: true, data: { ...data, bills: b.ok ? b.data : null } };
}

const saveInput = z.object({
  tabId: id("a bill").nullable(),
  version: version.nullable(),
  channel: salesChannel,
  tableId: id("a table").nullable(),
  label: optionalText(60),
  lines,
  /** The bill's discount, as it should now stand: a percentage, an amount, or neither. */
  discountPercent,
  discountAmount,
});

/** Open a bill with its first order, or save what is on one already open. */
export async function saveBillAction(
  input: z.input<typeof saveInput>,
): Promise<ActionResult<{ tabId: string; version: number; bills: OpenBill[] | null }>> {
  const v = parse(saveInput, input);
  if (!v.ok) return v;
  const d = v.data;
  if (d.tabId !== null && d.version === null)
    return { ok: false, error: "This bill has no version" };
  if (d.tabId === null && d.lines.length === 0)
    return { ok: false, error: "Add something to the bill first" };
  if (d.tabId === null && d.tableId === null && d.label === null)
    return { ok: false, error: "Give the bill a table or a name" };
  if (d.discountPercent !== null && d.discountAmount !== null)
    return { ok: false, error: "Give the discount as a percentage or as an amount, not both" };
  const r =
    d.tabId === null
      ? await callRpc<Record<string, unknown>>("open_tab", {
          p_channel: d.channel,
          p_table: d.tableId,
          p_label: d.label,
          p_lines: toDb(d.lines),
          p_discount_percent: d.discountPercent,
          p_discount_amount: d.discountAmount,
        })
      : await callRpc<Record<string, unknown>>("save_tab", {
          p_tab: d.tabId,
          p_version: d.version,
          p_lines: toDb(d.lines),
          p_label: d.label,
          p_table: d.tableId,
          p_discount_percent: d.discountPercent,
          p_discount_amount: d.discountAmount,
        });
  if (!r.ok) return r;
  return withBills({ tabId: String(r.data.tab_id), version: Number(r.data.version) });
}

const tabRef = z.object({ tabId: id("a bill"), version });

/** Printing the bill for the customer is recorded: from then on, taking items off needs a manager. */
export async function printBillAction(
  input: z.input<typeof tabRef>,
): Promise<ActionResult<{ printCount: number; bills: OpenBill[] | null }>> {
  const v = parse(tabRef, input);
  if (!v.ok) return v;
  const r = await callRpc<Record<string, unknown>>("mark_bill_printed", {
    p_tab: v.data.tabId,
    p_version: v.data.version,
  });
  if (!r.ok) return r;
  return withBills({ printCount: Number(r.data.print_count ?? 1) });
}

const payInput = tabRef.extend({
  /** Minted when the cashier starts taking payment, reused on every retry. */
  key: z.string().uuid("This payment has no idempotency key"),
  tender: z.enum(["cash", "card", "platform_paid"], { message: "Choose how it was paid" }),
  /** The total the till showed; the bill is not paid at another (0025). */
  expectedNet: optionalNonNegative("The total shown"),
});

/** Take the money: the bill becomes one sale. Paying twice returns the sale already recorded. */
export async function payBillAction(
  input: z.input<typeof payInput>,
): Promise<ActionResult<SaleReceipt & { bills: OpenBill[] | null }>> {
  const v = parse(payInput, input);
  if (!v.ok) return v;
  const r = await callRpc<Record<string, unknown>>("settle_tab", {
    p_tab: v.data.tabId,
    p_version: v.data.version,
    p_idempotency_key: v.data.key,
    p_tender: v.data.tender,
    p_expected_net: v.data.expectedNet,
  });
  if (!r.ok) return r;
  refresh(...PAID_PATHS);
  const d = r.data;
  const net = Number(d.net ?? 0);
  return withBills({
    orderId: String(d.order_id),
    gross: Number(d.gross ?? net),
    discount: Number(d.discount ?? 0),
    net,
    ...(d.cogs !== undefined ? { cogs: Number(d.cogs) } : {}),
    journalNo: d.journal_no == null ? null : Number(d.journal_no),
    replayed: Boolean(d.replayed),
  });
}

const splitInput = tabRef.extend({
  move: z
    .array(z.object({ lineId: id("a line"), qty: positive("Quantity") }))
    .min(1, "Choose what to move to the new bill"),
  label: optionalText(60),
});

/** Part of a table pays now: move it onto a bill of its own. */
export async function splitBillAction(
  input: z.input<typeof splitInput>,
): Promise<ActionResult<{ tabId: string; bills: OpenBill[] | null }>> {
  const v = parse(splitInput, input);
  if (!v.ok) return v;
  const r = await callRpc<Record<string, unknown>>("split_tab", {
    p_tab: v.data.tabId,
    p_version: v.data.version,
    p_move: v.data.move.map((m) => ({ line_id: m.lineId, qty: m.qty })),
    p_label: v.data.label,
  });
  if (!r.ok) return r;
  return withBills({ tabId: String(r.data.tab_id) });
}

const cancelInput = tabRef.extend({ reason: optionalText(300) });

/** An empty bill can be cancelled by anyone; one with items on it needs a manager and a reason. */
export async function cancelBillAction(
  input: z.input<typeof cancelInput>,
): Promise<ActionResult<{ bills: OpenBill[] | null }>> {
  const v = parse(cancelInput, input);
  if (!v.ok) return v;
  const r = await callRpc("cancel_tab", {
    p_tab: v.data.tabId,
    p_version: v.data.version,
    p_reason: v.data.reason,
  });
  if (!r.ok) return r;
  return withBills({});
}

const tableInput = z.object({
  id: id("a table").nullable(),
  name: text("The table's name", 40),
  area: optionalText(40),
  seats: z
    .number()
    .int()
    .min(1, "Seats must be 1 to 99")
    .max(99, "Seats must be 1 to 99")
    .nullable(),
  sortOrder: z.number().int(),
  isActive: z.boolean(),
});

/** Add a table, rename or reorder one, or take it out of use. */
export async function saveTableAction(
  input: z.input<typeof tableInput>,
): Promise<ActionResult<{ id: string }>> {
  const v = parse(tableInput, input);
  if (!v.ok) return v;
  const r = await callRpc<string>("save_table", {
    p_id: v.data.id,
    p_name: v.data.name,
    p_area: v.data.area,
    p_seats: v.data.seats,
    p_sort_order: v.data.sortOrder,
    p_is_active: v.data.isActive,
  });
  if (!r.ok) return r;
  refresh("/pos");
  return { ok: true, data: { id: String(r.data) } };
}
