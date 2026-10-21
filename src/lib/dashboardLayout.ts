/**
 * The Dashboard arranged for each role (SMART_PLAN F4). As the owner chose,
 * nobody arranges their own: the app puts first what each role decides from.
 *
 *  - The owner and a general manager: today's figures against the target,
 *    then what needs them, then the charts; sales lead the figures.
 *  - A branch manager runs the floor: what needs them comes first, then
 *    today; the hour by hour before the fortnight, and the stock before what
 *    sells.
 *  - An accountant or an auditor checks the books: gross profit leads the
 *    figures, yesterday's brief the charts, and the latest sales the side.
 *
 * Whoever it is, something red (it cannot wait) brings what needs them to
 * the top. Someone with more than one role is arranged for the most senior.
 */
export type DashLead = "owner" | "branch" | "books";
export type DashBlock = "today" | "needs" | "more";
export type DashMain = "fortnight" | "hours" | "brief";
export type DashSide = "sells" | "stock" | "recent";
export type DashFigure = "net" | "orders" | "average" | "profit";

export interface DashLayout {
  lead: DashLead;
  /** Something red brought what needs them to the top. */
  urgent: boolean;
  blocks: DashBlock[];
  main: DashMain[];
  side: DashSide[];
  figures: DashFigure[];
}

/** The most senior role first: the one a person is arranged for. */
const SENIORITY: [string, DashLead][] = [
  ["owner", "owner"],
  ["general_manager", "owner"],
  ["branch_manager", "branch"],
  ["accountant", "books"],
  ["auditor", "books"],
];

export function dashLead(roles: readonly string[]): DashLead {
  for (const [role, lead] of SENIORITY) if (roles.includes(role)) return lead;
  return "owner";
}

const LAYOUTS: Record<DashLead, Omit<DashLayout, "lead" | "urgent">> = {
  owner: {
    blocks: ["today", "needs", "more"],
    main: ["fortnight", "hours", "brief"],
    side: ["sells", "stock", "recent"],
    figures: ["net", "orders", "average", "profit"],
  },
  branch: {
    blocks: ["needs", "today", "more"],
    main: ["hours", "fortnight", "brief"],
    side: ["stock", "recent", "sells"],
    figures: ["net", "orders", "average", "profit"],
  },
  books: {
    blocks: ["today", "needs", "more"],
    main: ["brief", "fortnight", "hours"],
    side: ["recent", "stock", "sells"],
    figures: ["profit", "net", "average", "orders"],
  },
};

export function dashLayout(roles: readonly string[], redAlerts: number): DashLayout {
  const lead = dashLead(roles);
  const base = LAYOUTS[lead];
  const urgent = redAlerts > 0 && base.blocks[0] !== "needs";
  return {
    lead,
    urgent,
    ...base,
    blocks: urgent ? ["needs", ...base.blocks.filter((b) => b !== "needs")] : base.blocks,
  };
}

/** The items, in the layout's order. */
export function inOrder<K extends string, T>(order: readonly K[], items: Record<K, T>): T[] {
  return order.map((k) => items[k]);
}
