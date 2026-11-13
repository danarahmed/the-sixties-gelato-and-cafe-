/**
 * The order a customer builds on their phone (0118), as its QR carries it:
 * "S60O1." and each line, the size's id (32 hex digits) and how many, as the
 * till's scanner types it. Read back at the till into the bill's lines.
 */
export const QR_ORDER_PREFIX = "S60O1.";

export interface QrLine {
  variantId: string;
  qty: number;
}

const HEX32 = /^[0-9a-f]{32}$/;

export function encodeQrOrder(lines: QrLine[]): string {
  return (
    QR_ORDER_PREFIX +
    lines
      .filter((l) => l.qty > 0)
      .map(
        (l) => `${l.variantId.replace(/-/g, "").toLowerCase()}-${Math.min(99, Math.trunc(l.qty))}`,
      )
      .join(".")
  );
}

/** The lines of a scanned order; null when it is not one, or cannot be read. */
export function decodeQrOrder(raw: string): QrLine[] | null {
  const code = raw.trim();
  if (!code.startsWith(QR_ORDER_PREFIX)) return null;
  const parts = code.slice(QR_ORDER_PREFIX.length).split(".").filter(Boolean);
  if (parts.length === 0 || parts.length > 60) return null;
  const out: QrLine[] = [];
  for (const p of parts) {
    const [hex, n] = p.split("-");
    const qty = Number(n);
    if (!hex || !HEX32.test(hex.toLowerCase()) || !Number.isInteger(qty) || qty < 1 || qty > 99)
      return null;
    const h = hex.toLowerCase();
    out.push({
      variantId: `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`,
      qty,
    });
  }
  return out;
}

export interface PublicMenuItem {
  variantId: string;
  product: string;
  variant: string;
  nameAr: string | null;
  nameCkb: string | null;
  category: string | null;
  categoryAr: string | null;
  categoryCkb: string | null;
  price: number;
  imageUrl: string | null;
}

export interface PublicMenu {
  /** What the phone may send (0119): a table's order to the till; an order to take away or deliver. */
  toTill: boolean;
  online: boolean;
  business: string;
  place: string | null;
  decimals: number;
  items: PublicMenuItem[];
}

export function publicMenuFrom(v: unknown): PublicMenu {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const s = (x: unknown) => (x === null || x === undefined || x === "" ? null : String(x));
  return {
    toTill: o.to_till === true,
    online: o.online === true,
    business: String(o.business ?? ""),
    place: s(o.place),
    decimals: Number(o.decimals ?? 0),
    items: (Array.isArray(o.items) ? (o.items as Record<string, unknown>[]) : []).map((i) => ({
      variantId: String(i.variant_id),
      product: String(i.product ?? ""),
      variant: String(i.variant ?? ""),
      nameAr: s(i.name_ar),
      nameCkb: s(i.name_ckb),
      category: s(i.category),
      categoryAr: s(i.category_ar),
      categoryCkb: s(i.category_ckb),
      price: Number(i.price ?? 0),
      imageUrl: s(i.image_url),
    })),
  };
}
