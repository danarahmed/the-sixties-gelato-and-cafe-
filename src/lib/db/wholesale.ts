import "server-only";
/** The supplier's parts (0111): quotes, delivery notes, recent invoices. Null before 0111, or with the part off. */
import { db } from "./client";

export interface QuoteLine {
  variantId: string;
  name: string;
  qty: number;
  price: number;
}
export interface Quote {
  id: string;
  quoteNo: number;
  customer: string;
  status: "draft" | "sent" | "accepted" | "invoiced" | "cancelled";
  validUntil: string | null;
  note: string | null;
  lines: QuoteLine[];
  total: number;
  invoiceNo: number | null;
}
export interface DeliveryNote {
  id: string;
  noteNo: number;
  invoiceNo: number;
  customer: string;
  amount: number;
  driver: string | null;
  route: string | null;
  status: "prepared" | "out" | "delivered";
  receivedBy: string | null;
}
export interface RecentInvoice {
  id: string;
  invoiceNo: number;
  customer: string;
  amount: number;
  delivery: string | null;
}

const rows = (d: unknown) => (Array.isArray(d) ? (d as Record<string, unknown>[]) : []);
const s = (v: unknown) => (typeof v === "string" ? v : null);

export function toQuote(q: Record<string, unknown>): Quote {
  return {
    id: String(q.id),
    quoteNo: Number(q.quote_no ?? 0),
    customer: String(q.customer ?? ""),
    status: (["sent", "accepted", "invoiced", "cancelled"].includes(String(q.status))
      ? String(q.status)
      : "draft") as Quote["status"],
    validUntil: s(q.valid_until),
    note: s(q.note),
    lines: rows(q.lines).map((l) => ({
      variantId: String(l.variant_id),
      name: String(l.name ?? ""),
      qty: Number(l.qty ?? 0),
      price: Number(l.price ?? 0),
    })),
    total: Number(q.total ?? 0),
    invoiceNo: q.invoice_no == null ? null : Number(q.invoice_no),
  };
}

export async function getQuotes(): Promise<Quote[] | null> {
  const c = await db();
  const r = await c.rpc("quotes", { p_open_only: true });
  if (r.error) return null;
  return rows(r.data).map(toQuote);
}

export async function getDeliveryNotes(): Promise<DeliveryNote[] | null> {
  const c = await db();
  const r = await c.rpc("delivery_notes", { p_all: false });
  if (r.error) return null;
  return rows(r.data).map((d) => ({
    id: String(d.id),
    noteNo: Number(d.note_no ?? 0),
    invoiceNo: Number(d.invoice_no ?? 0),
    customer: String(d.customer ?? ""),
    amount: Number(d.amount ?? 0),
    driver: s(d.driver),
    route: s(d.route),
    status: (["out", "delivered"].includes(String(d.status))
      ? String(d.status)
      : "prepared") as DeliveryNote["status"],
    receivedBy: s(d.received_by),
  }));
}

export async function getRecentInvoices(): Promise<RecentInvoice[]> {
  const c = await db();
  const r = await c.rpc("recent_invoices");
  if (r.error) return [];
  return rows(r.data).map((i) => ({
    id: String(i.id),
    invoiceNo: Number(i.invoice_no ?? 0),
    customer: String(i.customer ?? ""),
    amount: Number(i.amount ?? 0),
    delivery: s(i.delivery),
  }));
}

/** The customers on account, and the sizes and stock items to quote and sell. */
export async function getWholesaleChoices(): Promise<{
  customers: { id: string; name: string }[];
  sizes: { id: string; name: string }[];
  items: { id: string; name: string }[];
}> {
  const c = await db();
  const [cu, sz, it] = await Promise.all([
    c
      .from("customer")
      .select("id,full_name,on_account,is_active")
      .eq("on_account", true)
      .eq("is_active", true)
      .order("full_name"),
    c
      .from("product_variant")
      .select("id,name,is_active,product:product_id(name)")
      .eq("is_active", true),
    c.from("item").select("id,name,is_active").eq("is_active", true).order("name"),
  ]);
  return {
    customers: ((cu.data ?? []) as { id: string; full_name: string }[]).map((x) => ({
      id: x.id,
      name: x.full_name,
    })),
    sizes: (
      (sz.data ?? []) as unknown as { id: string; name: string; product: { name: string } | null }[]
    )
      .map((v) => ({
        id: v.id,
        name: v.product
          ? v.name && v.name !== v.product.name
            ? `${v.product.name} · ${v.name}`
            : v.product.name
          : v.name,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    items: ((it.data ?? []) as { id: string; name: string }[]).map((x) => ({
      id: x.id,
      name: x.name,
    })),
  };
}
