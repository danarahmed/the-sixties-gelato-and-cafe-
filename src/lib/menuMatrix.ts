/**
 * The menu matrix (round eleven): every product the café sold in a period,
 * placed by how much it sells against how much it earns on each one sold, and
 * put in one of four groups, each with what to do about it. The classic menu
 * engineering of Kasavana and Smith: a product sells a lot when its share of
 * the items sold is at least 70% of an even share (1 in N); it earns well when
 * what it keeps on each one sold, after its cost, is at least the menu's
 * average, weighted by what was sold. Pure: the page and the tests read
 * through here, from the sales analysis by product (0051).
 */
import type { AnalysisRow, Names } from "@/lib/analysis";

export type MenuGroup = "keep" | "raise" | "promote" | "rethink";

/** The groups in their fixed order: the chart's colours and shapes follow it. */
export const MENU_GROUPS: readonly MenuGroup[] = ["keep", "raise", "promote", "rethink"];

/** Each group's name and what to do: phrases, shown through t(). */
export const GROUP_LABEL: Record<MenuGroup, string> = {
  keep: "Keep",
  raise: "Raise the price",
  promote: "Show it more",
  rethink: "Change it or drop it",
};

export const GROUP_WHY: Record<MenuGroup, string> = {
  keep: "Sells a lot and earns well on each one.",
  raise: "Sells a lot, but earns little on each one.",
  promote: "Earns well on each one, but few buy it.",
  rethink: "Sells little and earns little on each one.",
};

export const GROUP_DO: Record<MenuGroup, string> = {
  keep: "Keep it as it is, first on the menu and among the till's favourites.",
  raise: "Raise its price a little, or make it cost less to make.",
  promote: "Show it more: first on the menu, a favourite on the till, or offered to customers.",
  rethink: "Change its recipe or price, or take it off the menu.",
};

/** The share of an even share a product must reach to sell a lot. */
export const POPULAR_SHARE = 0.7;
/** A price step the café would charge in: a raise is rounded up to it. */
export const PRICE_STEP = 250;

export interface MenuItem {
  key: string;
  names: Names;
  /** Items sold in the period. */
  sold: number;
  /** Its share of every item the matrix counts, 0 to 1. */
  share: number;
  /** What it brought in, after discounts and refunds. */
  sales: number;
  /** What it kept after its cost, in all and on each one sold. */
  earned: number;
  perItem: number;
  group: MenuGroup;
  /** For "raise the price": what each one would need to earn the menu's average, rounded up. */
  raiseBy: number | null;
}

export interface MenuMatrix {
  items: MenuItem[];
  /** Items sold of the products the matrix counts. */
  sold: number;
  /** The menu's average earning on each item sold. */
  average: number;
  /** Sold at least this many to sell a lot. */
  popular: number;
  /** Sold, but with no cost to judge them by: left out, and named. */
  noCost: { key: string; names: Names; sold: number }[];
}

/** Rounded up to the café's price step. */
export function roundUp(amount: number, step = PRICE_STEP): number {
  return amount <= 0 ? 0 : Math.ceil(amount / step) * step;
}

/**
 * The matrix of the sales analysis's rows by product. A product with nothing
 * sold is left out; one sold with no cost (no recipe, or nothing priced on
 * it) is named apart, since what it earns cannot be told. Fewer than two
 * products left, and there is nothing to compare: no items.
 */
export function menuMatrix(rows: AnalysisRow[]): MenuMatrix {
  const sold = rows.filter((r) => r.qty > 0);
  const noCost = sold
    .filter((r) => r.cost <= 0)
    .map((r) => ({ key: r.key, names: r.names, sold: r.qty }));
  const counted = sold.filter((r) => r.cost > 0);
  const total = counted.reduce((n, r) => n + r.qty, 0);
  const earned = counted.reduce((n, r) => n + r.marginKept, 0);
  const average = total > 0 ? earned / total : 0;
  const popular = counted.length > 0 ? (POPULAR_SHARE * total) / counted.length : 0;
  if (counted.length < 2) return { items: [], sold: total, average, popular, noCost };

  const items = counted.map((r): MenuItem => {
    const perItem = r.marginKept / r.qty;
    const sellsALot = r.qty >= popular;
    const earnsWell = perItem >= average;
    const group: MenuGroup = sellsALot
      ? earnsWell
        ? "keep"
        : "raise"
      : earnsWell
        ? "promote"
        : "rethink";
    return {
      key: r.key,
      names: r.names,
      sold: r.qty,
      share: r.qty / total,
      sales: r.kept,
      earned: r.marginKept,
      perItem,
      group,
      raiseBy: group === "raise" ? roundUp(average - perItem) : null,
    };
  });
  // In each group, what matters most first: the most sold, then the most earned.
  items.sort(
    (a, b) =>
      MENU_GROUPS.indexOf(a.group) - MENU_GROUPS.indexOf(b.group) ||
      b.sold - a.sold ||
      b.earned - a.earned,
  );
  return { items, sold: total, average, popular, noCost };
}

/**
 * What raising the price of the "raise" group would bring in a period like
 * this one, if as many were sold: each raise times what was sold.
 */
export function raiseWorth(m: MenuMatrix): number {
  return m.items.reduce((n, i) => n + (i.raiseBy ?? 0) * i.sold, 0);
}

/** The phrases this file shows through t(). */
export const MENU_MATRIX_PHRASES: readonly string[] = [
  ...Object.values(GROUP_LABEL),
  ...Object.values(GROUP_WHY),
  ...Object.values(GROUP_DO),
];
