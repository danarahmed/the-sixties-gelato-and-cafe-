/**
 * The profit and loss by place (0056): each account at each of the café's
 * places, what belongs to none of them ("Shared": the bank's card fees, a
 * journal by hand), and the café's total, as the reports lay it out. The
 * places add up to the café, account by account: the database shares out what
 * spans them (a platform's payout, a payroll) before it gets here.
 */
export type PnlSection = "revenue" | "cost_of_sales" | "operating_expenses";

/** One account at one place (none: shared), in the natural direction. */
export interface PnlPlaceRow {
  code: string;
  name: string;
  section: PnlSection;
  placeId: string | null;
  place: string | null;
  amount: number;
}

/** A column: a place, or the shared one (id null, named "Shared"). */
export interface PnlColumn {
  id: string | null;
  name: string;
}

export interface PnlPlaceLine {
  code: string;
  name: string;
  section: PnlSection;
  /** One amount for each column, in the columns' order. */
  amounts: number[];
  total: number;
}

export interface PnlTotals {
  revenue: number;
  costOfSales: number;
  grossProfit: number;
  operating: number;
  net: number;
}

export interface PnlByPlace {
  columns: PnlColumn[];
  lines: PnlPlaceLine[];
  /** Each column's totals, in the columns' order. */
  totals: PnlTotals[];
  /** The café's. */
  total: PnlTotals;
}

function totalsOf(lines: PnlPlaceLine[], at: (l: PnlPlaceLine) => number): PnlTotals {
  const sum = (s: PnlSection) =>
    lines.filter((l) => l.section === s).reduce((t, l) => t + at(l), 0);
  const revenue = sum("revenue");
  const costOfSales = sum("cost_of_sales");
  const operating = sum("operating_expenses");
  return {
    revenue,
    costOfSales,
    grossProfit: revenue - costOfSales,
    operating,
    net: revenue - costOfSales - operating,
  };
}

/**
 * The table: a column for each of the café's places, in their order, then any
 * other place that has an amount (one since closed), then "Shared" when
 * anything is; a line for each account with an amount, by code.
 */
export function pnlByPlace(
  rows: PnlPlaceRow[],
  places: { id: string; name: string }[],
): PnlByPlace {
  const columns: PnlColumn[] = places.map((p) => ({ id: p.id, name: p.name }));
  for (const r of rows)
    if (r.placeId !== null && !columns.some((c) => c.id === r.placeId))
      columns.push({ id: r.placeId, name: r.place ?? r.placeId });
  if (rows.some((r) => r.placeId === null && r.amount !== 0))
    columns.push({ id: null, name: "Shared" });

  const byCode = new Map<string, PnlPlaceLine>();
  for (const r of rows) {
    if (r.amount === 0) continue;
    let line = byCode.get(r.code);
    if (!line) {
      line = {
        code: r.code,
        name: r.name,
        section: r.section,
        amounts: columns.map(() => 0),
        total: 0,
      };
      byCode.set(r.code, line);
    }
    const at = columns.findIndex((c) => c.id === r.placeId);
    line.amounts[at] = (line.amounts[at] ?? 0) + r.amount;
    line.total += r.amount;
  }
  const lines = [...byCode.values()].sort((a, b) => a.code.localeCompare(b.code));
  return {
    columns,
    lines,
    totals: columns.map((_, i) => totalsOf(lines, (l) => l.amounts[i] ?? 0)),
    total: totalsOf(lines, (l) => l.total),
  };
}
