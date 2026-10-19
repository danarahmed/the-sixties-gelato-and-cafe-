/**
 * The café's and the bakery's takings and profit told apart (round sixteen,
 * 0074): the sales analysis by category, each category counted in its
 * section, what refunds gave back taken off. A category with no section, and
 * the products of none, are counted apart, as "No section".
 */
import type { AnalysisRow } from "./analysis";

export interface SectionFigures {
  /** The section's id; null for what is of none. */
  id: string | null;
  name: string;
  /** Sales after discounts, less what refunds gave back. */
  sales: number;
  /** What was sold cost, less what refunds put back. */
  cost: number;
  profit: number;
  /** Of every section's sales, in percent (0–100), one decimal. */
  share: number;
  /** The profit on its sales, in percent; null with no sales. */
  margin: number | null;
}

export function bySection(
  rows: Pick<AnalysisRow, "key" | "kept" | "cost" | "costBack">[],
  categorySection: Record<string, string>,
  sections: { id: string; name: string; position: number }[],
  noneName: string,
): SectionFigures[] {
  const sums = new Map<string | null, { sales: number; cost: number }>();
  for (const r of rows) {
    const known = sections.find((s) => s.id === categorySection[r.key]);
    const id = known ? known.id : null;
    const s = sums.get(id) ?? { sales: 0, cost: 0 };
    s.sales += r.kept;
    s.cost += r.cost - r.costBack;
    sums.set(id, s);
  }
  const total = [...sums.values()].reduce((a, s) => a + s.sales, 0);
  const order = [...sections].sort((a, b) => a.position - b.position);
  const out: SectionFigures[] = [];
  const add = (id: string | null, name: string) => {
    const s = sums.get(id);
    if (!s) return;
    out.push({
      id,
      name,
      sales: s.sales,
      cost: s.cost,
      profit: s.sales - s.cost,
      share: total > 0 ? Math.round((s.sales / total) * 1000) / 10 : 0,
      margin: s.sales > 0 ? Math.round(((s.sales - s.cost) / s.sales) * 1000) / 10 : null,
    });
  };
  for (const s of order) add(s.id, s.name);
  add(null, noneName);
  return out;
}
