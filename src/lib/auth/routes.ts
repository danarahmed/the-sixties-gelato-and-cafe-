/**
 * Which screens each person may open, by the permissions their roles grant.
 *
 * This decides what the navigation shows and where a person lands. It is a
 * convenience, not the control: every read is filtered by row-level security
 * and every write is re-checked by the database function that performs it,
 * so a hidden screen reached by typing its address shows nothing it should not.
 */
import type { Permission } from "@domain/auth/permissions.js";

export interface NavEntry {
  href: string;
  key: string;
  /** Dictionary key of the heading the entry sits under (none for the first). */
  group: string | null;
  /** The screen is offered to anyone holding at least one of these. */
  anyOf: Permission[];
}

const REVENUE = "nav.group.revenue";
const SPENDING = "nav.group.spending";
const OPERATIONS = "nav.group.operations";
const BOOKS = "nav.group.books";

export const NAV: NavEntry[] = [
  { group: null, href: "/dashboard", key: "nav.dashboard", anyOf: ["profit.view"] },

  { group: REVENUE, href: "/sales", key: "nav.sales", anyOf: ["cost.view"] },
  { group: REVENUE, href: "/platforms", key: "nav.platforms", anyOf: ["cost.view"] },

  { group: SPENDING, href: "/vendors", key: "nav.vendors", anyOf: ["cost.view"] },
  { group: SPENDING, href: "/expenses", key: "nav.expenses", anyOf: ["cost.view"] },
  { group: SPENDING, href: "/purchasing", key: "nav.purchasing", anyOf: ["cost.view"] },

  { group: OPERATIONS, href: "/pos", key: "nav.pos", anyOf: ["sale.create"] },
  { group: OPERATIONS, href: "/orders", key: "nav.orders", anyOf: ["cost.view"] },
  { group: OPERATIONS, href: "/products", key: "nav.products", anyOf: ["cost.view"] },
  {
    group: OPERATIONS,
    href: "/inventory",
    key: "nav.inventory",
    anyOf: ["cost.view", "waste.record"],
  },
  {
    group: OPERATIONS,
    href: "/count",
    key: "nav.count",
    anyOf: ["inventory.count", "inventory.count.view_expected", "inventory.adjust.approve"],
  },
  {
    group: OPERATIONS,
    href: "/production",
    key: "nav.production",
    anyOf: ["cost.view", "production.record"],
  },

  { group: BOOKS, href: "/journals", key: "nav.journals", anyOf: ["cost.view"] },
  { group: BOOKS, href: "/accounting", key: "nav.chart", anyOf: ["cost.view"] },
  { group: BOOKS, href: "/reports", key: "nav.reports", anyOf: ["cost.view"] },
  { group: BOOKS, href: "/audit", key: "nav.audit", anyOf: ["audit.view"] },
  { group: BOOKS, href: "/settings", key: "nav.settings", anyOf: ["settings.manage"] },
];

export function holdsAny(permissions: readonly string[], anyOf: readonly string[]): boolean {
  return anyOf.some((p) => permissions.includes(p));
}

/** Where a person starts: the first screen their work begins on. */
export function homeFor(permissions: readonly string[]): string {
  if (permissions.includes("profit.view")) return "/dashboard";
  if (permissions.includes("sale.create")) return "/pos";
  if (permissions.includes("inventory.count")) return "/count";
  if (permissions.includes("waste.record")) return "/inventory";
  if (permissions.includes("cost.view")) return "/reports";
  return "/account";
}

/** Addresses anyone may open without signing in. */
export const PUBLIC_PATHS = ["/login", "/auth", "/setup"];

export function isPublicPath(path: string): boolean {
  return PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
}
