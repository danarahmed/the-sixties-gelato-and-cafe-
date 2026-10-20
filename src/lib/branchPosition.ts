/**
 * What each branch holds and owes, now (0084, G3): the cash in its till, its
 * stock at cost, stock it sent not yet received, its equipment at book value,
 * what customers owe on invoices made there, less the deposits it holds; with
 * its profit this year and what it sold to and bought from the other
 * branches at the transfer price. What is no one branch's is the café's.
 */

export interface BranchHolding {
  id: string;
  name: string;
  kind: string;
  till: number;
  stock: number;
  onItsWay: number;
  equipment: number;
  customersOwe: number;
  holds: number;
  deposits: number;
  net: number;
  profitThisYear: number;
  soldToBranches: number;
  boughtFromBranches: number;
  markupPercent: number;
}

export interface CafeHolding {
  safe: number;
  bank: number;
  toComeIn: number;
  equipment: number;
  customersOwe: number;
  owedToSuppliers: number;
  owedToStaff: number;
  profitThisYear: number;
  markupPercent: number;
}

export interface BranchPosition {
  places: BranchHolding[];
  cafe: CafeHolding | null;
  yearFrom: string;
}

const n = (v: unknown): number => (v === null || v === undefined ? 0 : Number(v));
const s = (v: unknown): string => (v === null || v === undefined ? "" : String(v));
const rec = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

/** The rows of a branch's position, in the order the screen shows them. */
export const BRANCH_HOLDS: { key: keyof BranchHolding; label: string }[] = [
  { key: "till", label: "Cash in its till" },
  { key: "stock", label: "Stock, at cost" },
  { key: "onItsWay", label: "Stock it sent, not yet received" },
  { key: "equipment", label: "Equipment, at book value" },
  { key: "customersOwe", label: "Customers owe, on its invoices" },
];

/** The café's position, as the database gives it (branch_position). */
export function branchPositionFrom(raw: unknown): BranchPosition {
  const r = rec(raw) ?? {};
  const places = (Array.isArray(r.places) ? r.places : []).map((v) => {
    const p = rec(v) ?? {};
    return {
      id: s(p.id),
      name: s(p.name),
      kind: s(p.kind),
      till: n(p.till),
      stock: n(p.stock),
      onItsWay: n(p.on_its_way),
      equipment: n(p.equipment),
      customersOwe: n(p.customers_owe),
      holds: n(p.holds),
      deposits: n(p.deposits),
      net: n(p.net),
      profitThisYear: n(p.profit_this_year),
      soldToBranches: n(p.sold_to_branches),
      boughtFromBranches: n(p.bought_from_branches),
      markupPercent: n(p.markup_percent),
    };
  });
  const c = rec(r.cafe);
  return {
    places,
    cafe: c
      ? {
          safe: n(c.safe),
          bank: n(c.bank),
          toComeIn: n(c.to_come_in),
          equipment: n(c.equipment),
          customersOwe: n(c.customers_owe),
          owedToSuppliers: n(c.owed_to_suppliers),
          owedToStaff: n(c.owed_to_staff),
          profitThisYear: n(c.profit_this_year),
          markupPercent: n(c.markup_percent),
        }
      : null,
    yearFrom: s(r.year_from),
  };
}
