import "server-only";
/** Packing (0107): what each order goes out in, and what it cost. Null before 0107. */
import type { PackingSetup } from "@/components/pos/model";
import { db } from "./client";

const ROLES = ["bag", "cup", "lid", "box", "other"] as const;

export async function getPackingSetup(): Promise<PackingSetup | null> {
  const c = await db();
  const r = await c.rpc("packing_setup");
  if (r.error || !r.data) return null;
  const d = r.data as { items?: Record<string, unknown>[]; variants?: Record<string, unknown>[] };
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);
  return {
    items: (d.items ?? []).map((i) => ({
      itemId: String(i.item_id),
      name: String(i.name ?? ""),
      nameAr: str(i.name_ar),
      nameCkb: str(i.name_ckb),
      role: (ROLES as readonly string[]).includes(String(i.role))
        ? (String(i.role) as PackingSetup["items"][number]["role"])
        : "other",
      takeaway: Number(i.takeaway ?? 0),
      delivery: Number(i.delivery ?? 0),
      active: i.active !== false,
    })),
    variants: (d.variants ?? []).map((v) => ({
      variantId: String(v.variant_id),
      itemId: String(v.item_id),
      qty: Number(v.qty ?? 0),
    })),
  };
}

export interface PackingReport {
  total: number;
  orders: number;
  items: { itemId: string; name: string; qty: number; cost: number }[];
  byDay: { day: string; orders: number; cost: number }[];
  byChannel: { channel: string; orders: number; cost: number; perOrder: number }[];
  byCashier: {
    memberId: string | null;
    name: string;
    orders: number;
    cost: number;
    perOrder: number;
    changed: number;
  }[];
  topOrders: {
    orderId: string;
    turnNo: number | null;
    at: string;
    channel: string;
    sale: number;
    cost: number;
    what: string;
  }[];
}

export async function getPackingReport(from: string, to: string): Promise<PackingReport | null> {
  const c = await db();
  const r = await c.rpc("report_packing", { p_from: from, p_to: to });
  if (r.error || !r.data) return null;
  const d = r.data as Record<string, unknown>;
  const list = (k: string) => (Array.isArray(d[k]) ? (d[k] as Record<string, unknown>[]) : []);
  const n = (v: unknown) => Number(v ?? 0);
  return {
    total: n(d.total),
    orders: n(d.orders),
    items: list("items").map((x) => ({
      itemId: String(x.item_id),
      name: String(x.name ?? ""),
      qty: n(x.qty),
      cost: n(x.cost),
    })),
    byDay: list("by_day").map((x) => ({
      day: String(x.day),
      orders: n(x.orders),
      cost: n(x.cost),
    })),
    byChannel: list("by_channel").map((x) => ({
      channel: String(x.channel),
      orders: n(x.orders),
      cost: n(x.cost),
      perOrder: n(x.per_order),
    })),
    byCashier: list("by_cashier").map((x) => ({
      memberId: x.member_id ? String(x.member_id) : null,
      name: String(x.name ?? "—"),
      orders: n(x.orders),
      cost: n(x.cost),
      perOrder: n(x.per_order),
      changed: n(x.changed),
    })),
    topOrders: list("top_orders").map((x) => ({
      orderId: String(x.order_id),
      turnNo: x.turn_no === null || x.turn_no === undefined ? null : n(x.turn_no),
      at: String(x.at ?? ""),
      channel: String(x.channel ?? ""),
      sale: n(x.sale),
      cost: n(x.cost),
      what: String(x.what ?? ""),
    })),
  };
}

/** The café's stock items and sizes, to choose packing from (Settings → Packing). */
export async function getPackingChoices(): Promise<{
  items: { id: string; name: string; unit: string }[];
  sizes: { id: string; name: string }[];
}> {
  const c = await db();
  const [items, sizes] = await Promise.all([
    c.from("item").select("id,name,base_unit_code,is_active").eq("is_active", true).order("name"),
    c.from("product_variant").select("id,name,product:product_id(name)").order("name"),
  ]);
  return {
    items: ((items.data ?? []) as { id: string; name: string; base_unit_code: string }[]).map(
      (i) => ({
        id: i.id,
        name: i.name,
        unit: i.base_unit_code,
      }),
    ),
    sizes: (
      (sizes.data ?? []) as unknown as {
        id: string;
        name: string;
        product: { name: string } | null;
      }[]
    )
      .map((v) => ({ id: v.id, name: v.product ? `${v.product.name} · ${v.name}` : v.name }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}
