/**
 * End-of-day markdowns (round twenty-one, 0079): what must be sold today,
 * sold off cheaper before it is thrown away.
 */

export interface MarkdownSize {
  variantId: string;
  product: string;
  size: string;
  servings: number;
  price: number | null;
  marked: number | null;
}

export interface MarkdownLot {
  lotId: string;
  item: string;
  unit: string;
  left: number;
  useBy: string;
  suggested: number;
  sizes: MarkdownSize[];
}

export interface RunningMarkdown {
  id: string;
  variantId: string;
  product: string;
  size: string;
  percent: number;
  endsAt: string;
}

export interface MarkdownBoard {
  until: string;
  lots: MarkdownLot[];
  running: RunningMarkdown[];
}

const n = (v: unknown) => (v == null ? 0 : Number(v));

export function markdownBoard(d: unknown): MarkdownBoard {
  const r = (d ?? {}) as Record<string, unknown>;
  const list = (v: unknown) => (Array.isArray(v) ? (v as Record<string, unknown>[]) : []);
  return {
    until: String(r.until ?? ""),
    lots: list(r.lots).map((l) => ({
      lotId: String(l.lot_id),
      item: String(l.item ?? ""),
      unit: String(l.unit ?? ""),
      left: n(l.left),
      useBy: String(l.use_by),
      suggested: n(l.suggested),
      sizes: list(l.sizes).map((s) => ({
        variantId: String(s.variant_id),
        product: String(s.product ?? ""),
        size: String(s.size ?? ""),
        servings: n(s.servings),
        price: s.price == null ? null : Number(s.price),
        marked: s.marked == null ? null : Number(s.marked),
      })),
    })),
    running: list(r.running).map((m) => ({
      id: String(m.id),
      variantId: String(m.variant_id),
      product: String(m.product ?? ""),
      size: String(m.size ?? ""),
      percent: n(m.percent),
      endsAt: String(m.ends_at),
    })),
  };
}

/** A price less a percentage, rounded as the café rounds money (whole dinars). */
export function markedDown(price: number, percent: number): number {
  return Math.round((price * (100 - percent)) / 100);
}
