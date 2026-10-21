import "server-only";
/**
 * Find anything (E4): what was typed, looked for at once among the products,
 * stock items, customers, suppliers, staff, purchase orders, sales and
 * journals. Each read runs as the signed-in person, so row-level security
 * shows only what their role may see; a kind they may not read is left out,
 * never an error. A handful of each, the best first.
 */
import { db, str, strOrNull, type Row } from "./client";
import { likeText, phoneTail } from "@/lib/find";

export interface Found {
  kind: "product" | "item" | "customer" | "supplier" | "staff" | "order" | "sale" | "journal";
  label: string;
  detail: string | null;
  href: string;
}

const EACH = 5;

/** A read that a role may not make gives nothing, not a broken search. */
async function safe(
  read: () => PromiseLike<{ data: Row[] | null; error: unknown }>,
): Promise<Row[]> {
  try {
    const r = await read();
    return r.error ? [] : (r.data ?? []);
  } catch {
    return [];
  }
}

/** The number typed, its digits read whatever the script; null when it is not one. */
function numberOf(q: string): number | null {
  const v = q
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/^#/, "");
  return /^\d{1,9}$/.test(v) ? Number(v) : null;
}

export async function findAnything(typed: string): Promise<Found[]> {
  const q = typed.trim().slice(0, 60);
  if (q.length < 2) return [];
  const c = await db();
  const like = `%${likeText(q)}%`;
  const names = `name.ilike.${like},name_ar.ilike.${like},name_ckb.ilike.${like}`;
  const n = numberOf(q);
  const tail = phoneTail(q);
  const hex = /^[0-9a-f]{8}$/i.test(q) ? q.toLowerCase() : null;

  const [products, items, customers, suppliers, staff, orders, journals] = await Promise.all([
    safe(() => c.from("product").select("id,name").or(names).eq("is_active", true).limit(EACH)),
    safe(() =>
      c
        .from("item")
        .select("id,name,sku")
        .or(`${names},sku.ilike.${like}`)
        .eq("is_active", true)
        .limit(EACH),
    ),
    safe(() =>
      c
        .from("customer")
        .select("id,full_name,phone")
        .or(tail ? `full_name.ilike.${like},phone.ilike.%${tail}` : `full_name.ilike.${like}`)
        .limit(EACH),
    ),
    safe(() => c.from("supplier").select("id,name,phone").ilike("name", like).limit(EACH)),
    safe(() =>
      c.from("employee").select("id,full_name,title").ilike("full_name", like).limit(EACH),
    ),
    n !== null
      ? safe(() => c.from("purchase_order").select("id,po_no,status").eq("po_no", n).limit(EACH))
      : Promise.resolve([] as Row[]),
    n !== null
      ? safe(() =>
          c
            .from("journal_entry")
            .select("id,journal_no,description")
            .eq("journal_no", n)
            .limit(EACH),
        )
      : Promise.resolve([] as Row[]),
  ]);

  const found: Found[] = [
    ...products.map((r) => ({
      kind: "product" as const,
      label: str(r.name),
      detail: null,
      href: `/products?q=${encodeURIComponent(str(r.name))}`,
    })),
    ...items.map((r) => ({
      kind: "item" as const,
      label: str(r.name),
      detail: strOrNull(r.sku),
      href: `/inventory/${str(r.id)}`,
    })),
    ...customers.map((r) => ({
      kind: "customer" as const,
      label: str(r.full_name),
      detail: strOrNull(r.phone),
      href: `/customers/${str(r.id)}`,
    })),
    ...suppliers.map((r) => ({
      kind: "supplier" as const,
      label: str(r.name),
      detail: strOrNull(r.phone),
      href: `/vendors?vendor=${str(r.id)}`,
    })),
    ...staff.map((r) => ({
      kind: "staff" as const,
      label: str(r.full_name),
      detail: strOrNull(r.title),
      href: "/staff#people",
    })),
    ...orders.map((r) => ({
      kind: "order" as const,
      label: `#${str(r.po_no)}`,
      detail: strOrNull(r.status),
      href: `/purchasing/orders/${str(r.id)}`,
    })),
    ...journals.map((r) => ({
      kind: "journal" as const,
      label: `#${str(r.journal_no)}`,
      detail: strOrNull(r.description),
      href: `/journals?q=${str(r.journal_no)}`,
    })),
  ];
  // A sale is found on Orders by its receipt number, its journal or its customer.
  if (hex || n !== null || tail) {
    found.push({
      kind: "sale",
      label: q,
      detail: null,
      href: `/orders?q=${encodeURIComponent(q)}`,
    });
  }
  return found;
}
