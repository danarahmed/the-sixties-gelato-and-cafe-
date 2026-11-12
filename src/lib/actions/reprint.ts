"use server";
/**
 * A sale's receipt printed again from Orders (0095's round, B3): as the
 * database recorded it, marked COPY. Nothing is written.
 */
import { z } from "zod";
import { db } from "@/lib/db/client";
import { getSalesOrders } from "@/lib/db/read";
import { getChannelNames } from "@/lib/db/channels";
import { requirePermission } from "@/lib/auth/session";
import type { ActionResult } from "@/lib/db/rpc";
import type { PrintJob } from "@/components/pos/PrintSlip";

const orderId = z.string().guid("Choose a sale");

export async function saleReceiptAction(id: string): Promise<ActionResult<PrintJob>> {
  await requirePermission("cost.view");
  const v = orderId.safeParse(id);
  if (!v.success) return { ok: false, error: "Choose a sale" };
  const [[o], channels, c] = await Promise.all([
    getSalesOrders(1, { ids: [v.data] }),
    getChannelNames(),
    db(),
  ]);
  if (!o) return { ok: false, error: "Sale not found" };
  if (o.status === "voided") return { ok: false, error: "A voided sale has no receipt to print" };
  const head = await c
    .from("sales_order")
    .select(
      "gross_amount,discount_amount,discount_percent,service_percent,tip_amount,turn_no,customer_id,delivery_address,platform_order_id",
    )
    .eq("id", o.id)
    .maybeSingle();
  // Before the columns of later updates: what the first read holds is enough.
  const h = (head.data ?? {}) as Record<string, unknown>;
  const n = (x: unknown) => (x === null || x === undefined ? 0 : Number(x));
  const [customer, platform, journal] = await Promise.all([
    h.customer_id
      ? c.from("customer").select("full_name,phone").eq("id", String(h.customer_id)).maybeSingle()
      : null,
    h.platform_order_id
      ? c
          .from("platform_order")
          .select("external_order_id")
          .eq("id", String(h.platform_order_id))
          .maybeSingle()
      : null,
    c
      .from("journal_entry")
      .select("journal_no")
      .eq("reference_type", "sales_order")
      .eq("reference_id", o.id)
      .is("reverses_entry", null)
      .order("created_at")
      .limit(1)
      .maybeSingle(),
  ]);
  const discount = n(h.discount_amount);
  const tip = n(h.tip_amount);
  const cust = customer?.data as { full_name?: string; phone?: string | null } | null | undefined;
  const change = o.payments.reduce((s, p) => s + (p.change ?? 0), 0);
  const job: PrintJob = {
    kind: "receipt",
    copy: true,
    title: cust?.full_name ?? "",
    channelLabel: channels.name(o.channel),
    lines: o.lines.map((l) => ({
      name: l.name,
      qty: l.qty,
      price: l.unitPrice,
      amount: l.lineNet,
      note: null,
    })),
    subtotal: h.gross_amount === undefined ? undefined : n(h.gross_amount),
    discount,
    discountLabel: n(h.discount_percent) > 0 ? `${n(h.discount_percent)}%` : null,
    service: o.service,
    servicePercent: n(h.service_percent) || null,
    tip,
    total: o.net + o.service + tip,
    tender: (o.tenders[0] ?? "cash") as PrintJob["tender"],
    payments: o.payments.map((p) => ({
      type: p.type,
      amount: p.amount,
      received: p.received,
      ...(p.currency === "USD" ? { currency: "USD" as const, usd: p.usd, rate: p.rate } : {}),
      ...(p.methodName ? { methodName: p.methodName } : {}),
      ...(p.deposit ? { deposit: true } : {}),
    })),
    change: change > 0 ? change : null,
    reference: o.id.slice(0, 8),
    platformOrderNo:
      (platform?.data as { external_order_id?: string } | null | undefined)?.external_order_id ??
      null,
    journalNo: (journal.data as { journal_no?: number } | null)?.journal_no ?? null,
    turnNo: h.turn_no === null || h.turn_no === undefined ? null : Number(h.turn_no),
    customer: cust?.full_name
      ? {
          name: cust.full_name,
          phone: cust.phone ?? null,
          address: (h.delivery_address as string | null) ?? null,
        }
      : null,
    at: o.placedAt,
    by: o.cashier ?? "—",
  };
  return { ok: true, data: job };
}
